import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { sql } from "@vercel/postgres";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return new Response("Service unavailable", { status: 503 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // 1. Get past 7 days of chat messages
    const chatMessages = await sql`
      SELECT m.role, m.content, s.mode, m.created_at
      FROM messages m
      JOIN sessions s ON s.id = m.session_id
      WHERE m.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY m.created_at ASC
      LIMIT 500
    `;

    // 2. Get past 7 days of evaluations
    const evaluations = await sql`
      SELECT
        score_total, score_product, score_pricing,
        score_sales, score_scale, score_finance,
        plan_text, full_response, created_at
      FROM evaluations
      WHERE created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at ASC
      LIMIT 50
    `;

    // 3. Get user statistics
    const userStats = await sql`
      SELECT
        COUNT(DISTINCT s.id)::int as total_sessions,
        COUNT(DISTINCT s.user_id)::int as logged_in_users,
        COUNT(DISTINCT s.ip)::int as unique_ips,
        COUNT(DISTINCT CASE WHEN s.mode = 'chat' THEN s.id END)::int as chat_sessions,
        COUNT(DISTINCT CASE WHEN s.mode = 'evaluate' THEN s.id END)::int as eval_sessions
      FROM sessions s
      WHERE s.created_at >= NOW() - INTERVAL '7 days'
    `;

    // 4. Get returning users (multiple sessions in the week)
    const returningUsers = await sql`
      SELECT s.user_id, u.name, COUNT(s.id)::int as session_count
      FROM sessions s
      JOIN auth_users u ON u.id = s.user_id
      WHERE s.created_at >= NOW() - INTERVAL '7 days'
      AND s.user_id IS NOT NULL
      GROUP BY s.user_id, u.name
      HAVING COUNT(s.id) > 1
    `;

    // 5. Get average messages per session
    const avgMessages = await sql`
      SELECT ROUND(AVG(msg_count), 1) as avg_messages
      FROM (
        SELECT s.id, COUNT(m.id) as msg_count
        FROM sessions s
        LEFT JOIN messages m ON m.session_id = s.id
        WHERE s.created_at >= NOW() - INTERVAL '7 days'
        GROUP BY s.id
      ) sub
    `;

    if (chatMessages.rows.length === 0 && evaluations.rows.length === 0) {
      return Response.json({ message: "No data to analyze this week" });
    }

    // 6. Build analysis prompt (anonymized - no raw user content)
    const chatSummary = chatMessages.rows
      .map(
        (m) =>
          `[${m.mode}][${m.role}] (${m.content.length}文字のメッセージ)`
      )
      .join("\n");

    const evalSummary = evaluations.rows
      .map(
        (e) =>
          `[Score: ${e.score_total}/100] Product:${e.score_product} Pricing:${e.score_pricing} Sales:${e.score_sales} Scale:${e.score_scale} Finance:${e.score_finance}`
      )
      .join("\n---\n");

    const stats = userStats.rows[0];
    const avgMsgCount = avgMessages.rows[0]?.avg_messages ?? 0;
    const returningCount = returningUsers.rows.length;

    const userStatsJson = {
      total_sessions: stats.total_sessions,
      logged_in_users: stats.logged_in_users,
      unique_ips: stats.unique_ips,
      chat_sessions: stats.chat_sessions,
      eval_sessions: stats.eval_sessions,
      returning_users: returningCount,
      avg_messages_per_session: Number(avgMsgCount),
    };

    const analysisPrompt = `あなたはマネタイズ相談AIサービスの改善アナリストです。以下は過去1週間のユーザー利用データです。

## ユーザー統計
- 総セッション数: ${stats.total_sessions}（チャット: ${stats.chat_sessions}、評価: ${stats.eval_sessions}）
- ログインユーザー数: ${stats.logged_in_users}
- ユニークIP数: ${stats.unique_ips}
- リピートユーザー数: ${returningCount}
- セッションあたり平均メッセージ数: ${avgMsgCount}

## チャットログ（${chatMessages.rows.length}件のメッセージ）
${chatSummary || "（なし）"}

## 事業計画評価（${evaluations.rows.length}件）
${evalSummary || "（なし）"}

## 分析タスク
以下の7つのセクションに分けて分析してください:

### 1. よくある質問トピック
ユーザーがよく質問するテーマを特定し、クラスタリングしてください。

### 2. 回答が不十分だった質問
AIが適切に回答できなかった、または情報が不足していた質問を特定してください。

### 3. ナレッジベースの不足領域
現在のナレッジベースに追加すべき情報を具体的に指摘してください。

### 4. プロンプト改善提案
システムプロンプトの改善案を具体的に提案してください。

### 5. 自動生成FAQ
頻出質問と理想的な回答のペアを3〜5個生成してください。以下の形式で:

Q: [質問]
A: [簡潔で正確な回答（2〜3文）]

### 6. ユーザー行動分析
- ログインユーザー vs 匿名ユーザーの利用傾向の違い
- リピートユーザーの相談テーマの変遷
- ユーザーがどこで会話を終了する傾向があるか（離脱ポイント）

### 7. 評価スコア傾向分析
- 今週の平均スコアと傾向
- 最も低スコアの軸（改善が必要な分野の推定）
- 高スコア事業計画の共通パターン`;

    // 7. Call Claude API for analysis
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      messages: [{ role: "user", content: analysisPrompt }],
    });

    const analysisText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // 8. Parse sections from analysis (## or ### heading levels)
    const faqMatch = analysisText.match(
      /#{2,3}\s*5\.\s*自動生成FAQ[^\n]*\n([\s\S]*?)(?=#{2,3}\s*6|$)/
    );
    const promptMatch = analysisText.match(
      /#{2,3}\s*4\.\s*プロンプト改善提案[^\n]*\n([\s\S]*?)(?=#{2,3}\s*5|$)/
    );
    const gapsMatch = analysisText.match(
      /#{2,3}\s*3\.\s*ナレッジベースの不足領域[^\n]*\n([\s\S]*?)(?=#{2,3}\s*4|$)/
    );

    // 9. Calculate week_start (Monday of current week)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - mondayOffset);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    // 10. Save to insights table with user_stats
    await sql`
      INSERT INTO insights (
        week_start, analysis, faq_additions,
        prompt_suggestions, knowledge_gaps, auto_applied, user_stats
      )
      VALUES (
        ${weekStartStr},
        ${analysisText},
        ${faqMatch?.[1]?.trim() ?? null},
        ${promptMatch?.[1]?.trim() ?? null},
        ${gapsMatch?.[1]?.trim() ?? null},
        ${true},
        ${JSON.stringify(userStatsJson)}
      )
    `;

    // 11. Send report email (fire-and-forget)
    try {
      const { Resend } = await import("resend");
      const resendClient = new Resend(process.env.RESEND_API_KEY);
      const notificationEmail = process.env.NOTIFICATION_EMAIL;
      if (notificationEmail) {
        await resendClient.emails.send({
          from: process.env.NOTIFICATION_FROM ?? "onboarding@resend.dev",
          to: notificationEmail,
          subject: `【週次レポート】マネタイズ相談 分析レポート - ${weekStartStr}`,
          text: `週次分析レポート\n\n📊 統計サマリ\n- 総セッション: ${stats.total_sessions}（チャット: ${stats.chat_sessions}、評価: ${stats.eval_sessions}）\n- ログインユーザー: ${stats.logged_in_users}\n- リピーター: ${returningCount}\n- 平均メッセージ数/セッション: ${avgMsgCount}\n\n${analysisText}`,
        });
      }
    } catch (emailErr) {
      console.error("Weekly report email failed:", emailErr);
    }

    return Response.json({
      message: "Analysis complete",
      weekStart: weekStartStr,
      chatMessages: chatMessages.rows.length,
      evaluations: evaluations.rows.length,
      userStats: userStatsJson,
    });
  } catch (error) {
    console.error("Cron analyze error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
