import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { buildEvaluationSystemPrompt } from "@/app/lib/prompts";
import { checkRateLimit, evalLimiter, authedEvalLimiter } from "@/app/lib/rate-limit";
import { createSession, logEvaluation } from "@/app/lib/db";
import { parseAllScores } from "@/app/lib/parse-scores";
import { waitUntil } from "@vercel/functions";
import { auth } from "@/auth";

export const maxDuration = 60;

const anthropic = new Anthropic();

async function extractPlanText(
  request: NextRequest
): Promise<{ text: string; truncated: boolean }> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const text = formData.get("text") as string | null;

    if (file) {
      const { parseFile } = await import("@/app/lib/file-parser");
      const buffer = Buffer.from(await file.arrayBuffer());
      return parseFile(buffer, file.name);
    }
    if (text?.trim()) {
      return { text: text.trim(), truncated: false };
    }
    throw new Error("ファイルまたはテキストを入力してください");
  }

  const body = await request.json();
  if (body.text?.trim()) {
    return { text: body.text.trim(), truncated: false };
  }
  throw new Error("事業計画のテキストを入力してください");
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const limiter = userId ? authedEvalLimiter : evalLimiter;
    const rateLimit = await checkRateLimit(request, limiter, userId);
    if (!rateLimit.success) {
      return new Response(
        JSON.stringify({
          error: "1日の評価上限に達しました。明日またお試しください。",
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    const { text: planText, truncated } = await extractPlanText(request);
    const systemPrompt = buildEvaluationSystemPrompt(planText);

    // Create session for logging
    let sessionId: string | null = null;
    try {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? null;
      const userAgent = request.headers.get("user-agent") ?? null;
      sessionId = await createSession(ip, userAgent, "evaluate", userId);
    } catch (e) {
      console.error("Failed to create session:", e);
    }

    let fullResponse = "";
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8192,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: "この事業計画を5軸で評価してください。",
        },
      ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "evaluation_start" })}\n\n`
            )
          );

          if (truncated) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "truncation_warning" })}\n\n`
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
          const scores = parseAllScores(fullResponse);
          const afterTasks: Promise<unknown>[] = [];

          if (scores.total !== null && scores.total > 80) {
            const { sendHighScoreNotification } = await import("@/app/lib/email");
            afterTasks.push(
              sendHighScoreNotification(
                scores.total,
                planText.slice(0, 500),
                fullResponse
              ).catch((err) => console.error("Email notification failed:", err))
            );
          }

          if (sessionId) {
            afterTasks.push(
              logEvaluation(sessionId, planText, scores, fullResponse).catch(
                (err) => console.error("Evaluation logging failed:", err)
              )
            );
          }

          if (afterTasks.length > 0) {
            waitUntil(Promise.all(afterTasks));
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
    console.error("Evaluate API error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
