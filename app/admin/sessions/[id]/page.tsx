import { sql } from "@vercel/postgres";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getSession(id: string) {
  const result = await sql`
    SELECT * FROM sessions WHERE id = ${id}
  `;
  return result.rows[0] ?? null;
}

async function getMessages(sessionId: string) {
  const result = await sql`
    SELECT * FROM messages
    WHERE session_id = ${sessionId}
    ORDER BY created_at ASC
  `;
  return result.rows;
}

async function getEvaluation(sessionId: string) {
  const result = await sql`
    SELECT * FROM evaluations
    WHERE session_id = ${sessionId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return result.rows[0] ?? null;
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();

  const [messages, evaluation] = await Promise.all([
    getMessages(id),
    getEvaluation(id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/sessions"
          className="text-sm text-zinc-500 hover:text-zinc-700"
        >
          &larr; Sessions
        </Link>
        <h1 className="text-xl font-bold text-zinc-900">Session Detail</h1>
      </div>

      {/* Session Info */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-zinc-500">ID</dt>
            <dd className="font-mono text-xs text-zinc-800">{session.id}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Mode</dt>
            <dd>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  session.mode === "chat"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {session.mode}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">IP</dt>
            <dd className="text-zinc-800">{session.ip ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Created</dt>
            <dd className="text-zinc-800">
              {new Date(session.created_at).toLocaleString("ja-JP")}
            </dd>
          </div>
        </dl>
      </div>

      {/* Evaluation Score (if applicable) */}
      {evaluation && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="mb-3 text-sm font-semibold text-emerald-800">
            Evaluation Score
          </h2>
          <div className="grid grid-cols-6 gap-2 text-center text-sm">
            <div>
              <div className="text-xl font-bold text-emerald-700">
                {evaluation.score_total ?? "-"}
              </div>
              <div className="text-xs text-emerald-600">Total</div>
            </div>
            {[
              { label: "売り物", key: "score_product" },
              { label: "値付け", key: "score_pricing" },
              { label: "売る人", key: "score_sales" },
              { label: "売れる仕組み", key: "score_scale" },
              { label: "売上管理", key: "score_finance" },
            ].map(({ label, key }) => (
              <div key={key}>
                <div className="text-lg font-semibold text-emerald-700">
                  {evaluation[key] ?? "-"}
                </div>
                <div className="text-xs text-emerald-600">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700">
          Messages ({messages.length})
        </h2>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-100 bg-white text-zinc-800 shadow-sm"
              }`}
            >
              <div className="mb-1 text-xs opacity-60">
                {msg.role} &middot;{" "}
                {new Date(msg.created_at).toLocaleTimeString("ja-JP")}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-sm text-zinc-400">No messages in this session.</p>
        )}
      </div>
    </div>
  );
}
