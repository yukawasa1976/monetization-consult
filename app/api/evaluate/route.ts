import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { buildEvaluationSystemPrompt } from "@/app/lib/prompts";
import { parseFile } from "@/app/lib/file-parser";
import { sendHighScoreNotification } from "@/app/lib/email";

const anthropic = new Anthropic();

async function extractPlanText(request: NextRequest): Promise<string> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const text = formData.get("text") as string | null;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      return parseFile(buffer, file.name);
    }
    if (text?.trim()) {
      return text.trim();
    }
    throw new Error("ファイルまたはテキストを入力してください");
  }

  const body = await request.json();
  if (body.text?.trim()) {
    return body.text.trim();
  }
  throw new Error("事業計画のテキストを入力してください");
}

export async function POST(request: NextRequest) {
  try {
    const planText = await extractPlanText(request);
    const systemPrompt = buildEvaluationSystemPrompt(planText);

    let fullResponse = "";
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
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

          // Fire-and-forget email notification
          const scoreMatch = fullResponse.match(
            /【総合スコア:\s*(\d+)\/100】/
          );
          if (scoreMatch) {
            const score = parseInt(scoreMatch[1], 10);
            if (score > 80) {
              sendHighScoreNotification(
                score,
                planText.slice(0, 500),
                fullResponse
              ).catch((err) =>
                console.error("Email notification failed:", err)
              );
            }
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
