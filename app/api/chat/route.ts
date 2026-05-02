import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { getChatSystemPrompt } from "@/app/lib/prompts";
import { checkRateLimit, chatLimiter, authedChatLimiter } from "@/app/lib/rate-limit";
import { createSession, logMessage, touchSession } from "@/app/lib/db";
import { waitUntil } from "@vercel/functions";
import { auth } from "@/auth";

export const maxDuration = 60;

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const limiter = userId ? authedChatLimiter : chatLimiter;
    const rateLimit = await checkRateLimit(request, limiter, userId);
    if (!rateLimit.success) {
      return new Response(
        JSON.stringify({
          error: "1日のチャット上限に達しました。明日またお試しください。",
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    const { messages, sessionId: existingSessionId } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Session management
    let sessionId = existingSessionId;
    if (!sessionId) {
      try {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? null;
        const userAgent = request.headers.get("user-agent") ?? null;
        sessionId = await createSession(ip, userAgent, "chat", userId);
      } catch (e) {
        console.error("Failed to create session:", e);
      }
    }

    // Get the latest user message for logging
    const lastUserMessage = messages[messages.length - 1]?.content ?? "";

    const systemPrompt = await getChatSystemPrompt();

    // Find the second-to-last user message to set a cache breakpoint.
    // Anthropic prompt caching only applies to user turns, and caching the
    // growing conversation prefix saves tokens on every turn from turn 3 onward.
    const userIndices = messages
      .map((msg: { role: string; content: string }, i: number) => (msg.role === "user" ? i : -1))
      .filter((i: number) => i !== -1);
    const cacheBreakpointIndex =
      userIndices.length >= 2 ? userIndices[userIndices.length - 2] : -1;

    const processedMessages = messages.map(
      (msg: { role: string; content: string }, index: number) => {
        if (index === cacheBreakpointIndex) {
          return {
            role: msg.role as "user" | "assistant",
            content: [
              {
                type: "text" as const,
                text: msg.content,
                cache_control: { type: "ephemeral" as const },
              },
            ],
          };
        }
        return {
          role: msg.role as "user" | "assistant",
          content: msg.content,
        };
      }
    );

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemPrompt,
      messages: processedMessages,
    });

    let fullResponse = "";
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send sessionId to client
          if (sessionId) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ sessionId })}\n\n`
              )
            );
          }

          for await (const event of stream) {
            if (event.type === "message_start" && event.message.usage) {
              const u = event.message.usage as unknown as Record<string, number>;
              if (u.cache_read_input_tokens || u.cache_creation_input_tokens) {
                console.log("[cache]", {
                  read: u.cache_read_input_tokens ?? 0,
                  write: u.cache_creation_input_tokens ?? 0,
                  input: u.input_tokens,
                });
              }
            }
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              fullResponse += event.delta.text;
              const data = JSON.stringify({ text: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();

          // Log after response completes (survives serverless shutdown)
          if (sessionId) {
            waitUntil(
              Promise.all([
                logMessage(sessionId, "user", lastUserMessage),
                logMessage(sessionId, "assistant", fullResponse),
                touchSession(sessionId),
              ]).catch((err) => console.error("Chat logging failed:", err))
            );
          }
        } catch (error) {
          console.error("Chat stream error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Stream error" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
