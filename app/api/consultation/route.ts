import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { Resend } from "resend";
import { scoreApplication } from "@/app/lib/scoring";
import { saveInvestmentLead } from "@/app/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const formData = await req.formData();
  const type = (formData.get("type") as string) || "consultation";
  const name = formData.get("name") as string;
  const company = formData.get("company") as string | null;
  const xAccount = formData.get("xAccount") as string | null;
  const topic = formData.get("topic") as string | null;
  const file = formData.get("file") as File | null;
  const answerNonSub = (formData.get("answerNonSub") as string) || "";
  const answerDelegation = (formData.get("answerDelegation") as string) || "";
  const answerEconomics = (formData.get("answerEconomics") as string) || "";
  const answerException = (formData.get("answerException") as string) || "";

  if (type === "wallhitting") {
    if (!name || !topic) {
      return NextResponse.json(
        { error: "お名前と相談テーマは必須です" },
        { status: 400 }
      );
    }
    if (!answerNonSub || !answerDelegation || !answerEconomics || !answerException) {
      return NextResponse.json(
        { error: "4つの評価設問すべてに回答してください" },
        { status: 400 }
      );
    }
  } else {
    if (!name || !company || !file) {
      return NextResponse.json(
        { error: "名前、会社名、事業計画書は必須です" },
        { status: 400 }
      );
    }
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

  if (type === "wallhitting") {
    // スコア計算 + DB保存
    const answers = {
      nonSubstitutability: answerNonSub,
      delegation: answerDelegation,
      economics: answerEconomics,
      exceptionOps: answerException,
    };
    const { score, level, reasons } = scoreApplication(answers);

    // セッションからuserId取得（auth.tsのJWT callbackでuserIdがある場合）
    const userId = (session.user as { userId?: string }).userId ?? null;

    await saveInvestmentLead({
      userId,
      name,
      email: session.user.email,
      xAccount: xAccount || null,
      answers,
      score,
      level,
    });

    await resend.emails.send({
      from,
      to,
      subject: `【壁打ち申し込み】${name}様 [${level} ${score}点] - マネタイズ相談`,
      text: [
        `壁打ちの申し込みがありました。`,
        ``,
        `■ スコア: ${score}点 / 判定: ${level}`,
        `理由: ${reasons.join(", ") || "該当なし"}`,
        ``,
        `名前: ${name}`,
        `メール: ${session.user.email}`,
        xAccount ? `X: ${xAccount}` : null,
        ``,
        `相談テーマ:`,
        topic,
        ``,
        `--- AI活用の証明 ---`,
        `① 非代替性:`,
        answerNonSub,
        ``,
        `② 委任深度:`,
        answerDelegation,
        ``,
        `③ 運用経済性:`,
        answerEconomics,
        ``,
        `④ 例外設計:`,
        answerException,
      ]
        .filter((v) => v !== null)
        .join("\n"),
    });
  } else {
    const fileBuffer = Buffer.from(await file!.arrayBuffer());
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
          filename: file!.name,
          content: fileBuffer,
        },
      ],
    });
  }

  return NextResponse.json({ success: true });
}
