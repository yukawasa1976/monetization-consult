import { sql } from "@vercel/postgres";
import { encrypt, decrypt } from "./crypto";

export async function createSession(
  ip: string | null,
  userAgent: string | null,
  mode: "chat" | "evaluate",
  userId: string | null = null
): Promise<string> {
  const result = await sql`
    INSERT INTO sessions (ip, user_agent, mode, user_id)
    VALUES (${ip}, ${userAgent}, ${mode}, ${userId})
    RETURNING id
  `;
  return result.rows[0].id;
}

export async function logMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const encryptedContent = encrypt(content);
  await sql`
    INSERT INTO messages (session_id, role, content)
    VALUES (${sessionId}, ${role}, ${encryptedContent})
  `;
}

export async function logEvaluation(
  sessionId: string,
  planText: string,
  scores: {
    total: number | null;
    product: number | null;
    pricing: number | null;
    sales: number | null;
    scale: number | null;
    finance: number | null;
  },
  fullResponse: string
): Promise<void> {
  const encryptedPlan = encrypt(planText);
  const encryptedResponse = encrypt(fullResponse);
  await sql`
    INSERT INTO evaluations (
      session_id, plan_text, score_total,
      score_product, score_pricing, score_sales,
      score_scale, score_finance, full_response
    )
    VALUES (
      ${sessionId}, ${encryptedPlan}, ${scores.total},
      ${scores.product}, ${scores.pricing}, ${scores.sales},
      ${scores.scale}, ${scores.finance}, ${encryptedResponse}
    )
  `;
}

export async function touchSession(sessionId: string): Promise<void> {
  await sql`
    UPDATE sessions SET updated_at = NOW() WHERE id = ${sessionId}
  `;
}

// --- マイページ用クエリ ---

export async function getUserSessions(userId: string, limit = 20, offset = 0) {
  const result = await sql`
    SELECT
      s.id, s.mode, s.created_at, s.updated_at,
      COUNT(m.id)::int as message_count,
      (SELECT content FROM messages WHERE session_id = s.id AND role = 'user' ORDER BY created_at ASC LIMIT 1) as first_message
    FROM sessions s
    LEFT JOIN messages m ON m.session_id = s.id
    WHERE s.user_id = ${userId}
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return result.rows.map((row) => {
    row.first_message = row.first_message ? decrypt(row.first_message) : null;
    return row;
  });
}

export async function getUserEvaluations(userId: string) {
  const result = await sql`
    SELECT
      e.id, e.session_id, e.score_total,
      e.score_product, e.score_pricing,
      e.score_sales, e.score_scale, e.score_finance,
      e.plan_text, e.created_at
    FROM evaluations e
    JOIN sessions s ON s.id = e.session_id
    WHERE s.user_id = ${userId}
    ORDER BY e.created_at DESC
  `;
  return result.rows.map((row) => {
    row.plan_text = row.plan_text ? decrypt(row.plan_text) : null;
    return row;
  });
}

export async function getSessionMessages(sessionId: string, userId: string) {
  const result = await sql`
    SELECT m.id, m.role, m.content, m.created_at
    FROM messages m
    JOIN sessions s ON s.id = m.session_id
    WHERE m.session_id = ${sessionId} AND s.user_id = ${userId}
    ORDER BY m.created_at ASC
  `;
  return result.rows.map((row) => {
    row.content = decrypt(row.content);
    return row;
  });
}

// --- フィードバック ---

export async function saveFeedback(
  category: string,
  content: string,
  userId: string | null,
  sessionId: string | null
): Promise<void> {
  const encryptedContent = encrypt(content);
  await sql`
    INSERT INTO feedbacks (category, content, user_id, session_id)
    VALUES (${category}, ${encryptedContent}, ${userId}, ${sessionId})
  `;
}

export async function getFeedbacks(limit = 50, offset = 0) {
  const result = await sql`
    SELECT
      f.id, f.category, f.content, f.created_at,
      u.name as user_name, u.email as user_email
    FROM feedbacks f
    LEFT JOIN auth_users u ON u.id = f.user_id
    ORDER BY f.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return result.rows.map((row) => {
    row.content = decrypt(row.content);
    return row;
  });
}

// --- シェア機能 ---

export async function createShareToken(
  sessionId: string,
  userId: string | null
): Promise<string> {
  // 所有者チェック: ログインユーザーは自分のセッションのみシェア可能
  if (userId) {
    const ownerCheck = await sql`
      SELECT id FROM sessions WHERE id = ${sessionId} AND user_id = ${userId} LIMIT 1
    `;
    if (ownerCheck.rows.length === 0) {
      throw new Error("Unauthorized: session does not belong to user");
    }
  }

  // 同一セッションで既存トークンがあればそれを返す
  const existing = await sql`
    SELECT token FROM session_shares WHERE session_id = ${sessionId} LIMIT 1
  `;
  if (existing.rows.length > 0) {
    return existing.rows[0].token;
  }
  const result = await sql`
    INSERT INTO session_shares (session_id, created_by)
    VALUES (${sessionId}, ${userId})
    RETURNING token
  `;
  return result.rows[0].token;
}

export async function getShareMessages(token: string) {
  const result = await sql`
    SELECT m.id, m.role, m.content, m.created_at
    FROM messages m
    JOIN session_shares ss ON ss.session_id = m.session_id
    WHERE ss.token = ${token}::uuid
    ORDER BY m.created_at ASC
  `;
  return result.rows.map((row) => {
    row.content = decrypt(row.content);
    return row;
  });
}

export async function getUserSessionCount(userId: string): Promise<number> {
  const result = await sql`
    SELECT COUNT(*)::int as count FROM sessions WHERE user_id = ${userId}
  `;
  return result.rows[0].count;
}
