import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { auth } from "@/auth";
import { saveFeedback } from "@/app/lib/db";
import { waitUntil } from "@vercel/functions";

export async function POST(request: NextRequest) {
  try {
    const { category, content, sessionId } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "内容を入力してください" },
        { status: 400 }
      );
    }

    const validCategories = ["bug", "improvement", "other"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: "カテゴリが不正です" },
        { status: 400 }
      );
    }

    const session = await auth();
    const userId = session?.user?.id ?? null;

    const categoryLabel: Record<string, string> = {
      bug: "バグ報告",
      improvement: "改善要望",
      other: "その他",
    };

    // DB保存 + メール送信を非同期で実行
    waitUntil(
      (async () => {
        await saveFeedback(category, content.trim(), userId, sessionId ?? null);

        const apiKey = process.env.RESEND_API_KEY;
        const to = process.env.NOTIFICATION_EMAIL;
        const from = process.env.NOTIFICATION_FROM || "onboarding@resend.dev";

        if (apiKey && to) {
          const resend = new Resend(apiKey);
          await resend.emails.send({
            from,
            to,
            subject: `【フィードバック】${categoryLabel[category]} - マネタイズ相談`,
            text:
              `カテゴリ: ${categoryLabel[category]}\n\n` +
              `内容:\n${content.trim()}\n\n` +
              `───────────\n` +
              `ユーザー: ${session?.user?.name ?? "未ログイン"}${session?.user?.email ? ` (${session.user.email})` : ""}\n` +
              `日時: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`,
          });
        }
      })().catch((err) => console.error("Feedback processing failed:", err))
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Feedback API error:", error);
    return NextResponse.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
