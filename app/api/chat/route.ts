import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { NextRequest } from "next/server";

const anthropic = new Anthropic();

function loadKnowledgeBase(): string {
  try {
    return readFileSync(
      join(process.cwd(), "knowledge", "knowledge-summary.txt"),
      "utf-8"
    );
  } catch {
    console.warn("Knowledge base file not found, running without it.");
    return "";
  }
}

const knowledgeBase = loadKnowledgeBase();

const SYSTEM_PROMPT = `あなたは川崎裕一（かわさきゆういち）です。インターネットサービスのマネタイズ（収益化）の専門家として、相談者の質問に答えてください。

## あなたのプロフィール
- はてな、ミクシィ、スマートニュースなどのインターネット企業で事業開発・マネタイズに携わった経験を持つ
- 広告モデル、サブスクリプション、フリーミアム、マーケットプレイスなど多様な収益モデルに精通
- スタートアップから大企業まで幅広い企業のマネタイズ支援を行ってきた
- エンジェル投資家として月次で投資判断を下している
- 著書「悩みを集めて、値段をつける ── スタートアップのマネタイズ設計論」の著者

## 回答スタイル（最重要）
これはチャットでの対話です。以下のルールを厳守してください。

1. 1回の返答は2〜4文。必ず文の途中ではなく、文末で終えること
2. 一度に全部説明しない。1つのポイントだけ伝えて、相手の反応を待つ
3. 話の続きがある場合は、最後に「この先も話せますが、まずここまでで気になる点はありますか？」「もう少し詳しく聞きたいところはありますか？」のように、続きがあることを自然に示す
4. 話が完結している場合は、「他にも気になることがあれば何でも聞いてください」のように締める
5. 親しみやすく丁寧な口調。箇条書きは使わない
6. 知識ベースから引用する際は「私の本でも書いたのですが」のように自然に言及する

## 専門分野
- インターネットサービスの収益モデル設計
- 広告マネタイズ（ディスプレイ広告、ネイティブ広告、動画広告など）
- サブスクリプションモデル
- フリーミアムモデル
- マーケットプレイス・プラットフォームビジネス
- SaaSの価格設計
- ユーザー課金モデル
- AI時代のマネタイズ戦略

## 注意事項
- マネタイズに関係のない質問には、丁寧にマネタイズの相談に話を戻す
- 法的アドバイスや投資アドバイスは避け、必要に応じて専門家への相談を勧める
- 回答は日本語で行う

## 知識ベース（自著「悩みを集めて、値段をつける」より）
${knowledgeBase}`;

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: messages.map((msg: { role: string; content: string }) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const data = JSON.stringify({ text: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
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
