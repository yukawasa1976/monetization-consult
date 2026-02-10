import { Resend } from "resend";

export async function sendHighScoreNotification(
  score: number,
  planSummary: string,
  evaluation: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFICATION_EMAIL;
  const from = process.env.NOTIFICATION_FROM || "onboarding@resend.dev";

  if (!apiKey || !to) {
    console.warn("Email not configured: RESEND_API_KEY or NOTIFICATION_EMAIL missing");
    return;
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to,
    subject: `【スコア${score}点】事業計画評価通知 - マネタイズ相談`,
    text: `スコア${score}/100の事業計画が提出されました。\n\n` +
      `── 事業計画（冒頭500文字）──\n${planSummary}\n\n` +
      `── 評価内容 ──\n${evaluation}`,
  });
}
