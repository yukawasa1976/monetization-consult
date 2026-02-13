import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { getChatSystemPrompt } from "@/app/lib/prompts";
import { checkRateLimit, chatLimiter, authedChatLimiter } from "@/app/lib/rate-limit";
import { createSession, logMessage, touchSession } from "@/app/lib/db";
import { waitUntil } from "@vercel/functions";
import { auth } from "@/auth";

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

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((msg: { role: string; content: string }) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
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
          const message =
            error instanceof Error ? error.message : "Stream error";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: message })}\n\n`
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
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
