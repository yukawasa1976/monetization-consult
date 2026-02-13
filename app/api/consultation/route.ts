import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const formData = await req.formData();
  const name = formData.get("name") as string;
  const company = formData.get("company") as string;
  const xAccount = formData.get("xAccount") as string | null;
  const file = formData.get("file") as File | null;

  if (!name || !company || !file) {
    return NextResponse.json(
      { error: "名前、会社名、事業計画書は必須です" },
      { status: 400 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFICATION_EMAIL;
  const from = process.env.NOTIFICATION_FROM || "onboarding@resend.dev";

  if (!apiKey || !to) {
    return NextResponse.json(
      { error: "メール設定がされていません" },
      { status: 500 }
    );
  }

  const resend = new Resend(apiKey);

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  await resend.emails.send({
    from,
    to,
    subject: `【直接相談依頼】${company} ${name}様 - マネタイズ相談`,
    text: [
      `直接相談の依頼がありました。`,
      ``,
      `名前: ${name}`,
      `会社名: ${company}`,
      `メール: ${session.user.email}`,
      xAccount ? `X: ${xAccount}` : null,
      ``,
      `事業計画書を添付しています。`,
    ]
      .filter(Boolean)
      .join("\n"),
    attachments: [
      {
        filename: file.name,
        content: fileBuffer,
      },
    ],
  });

  return NextResponse.json({ success: true });
}
