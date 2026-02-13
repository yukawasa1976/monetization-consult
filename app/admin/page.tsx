import { sql } from "@vercel/postgres";
import UsageChart from "./components/UsageChart";

export const dynamic = "force-dynamic";

async function getStats() {
  const [sessions, messages, evaluations, avgScore] = await Promise.all([
    sql`SELECT COUNT(*) as count FROM sessions`,
    sql`SELECT COUNT(*) as count FROM messages`,
    sql`SELECT COUNT(*) as count FROM evaluations`,
    sql`SELECT ROUND(AVG(score_total), 1) as avg FROM evaluations WHERE score_total IS NOT NULL`,
  ]);

  return {
    totalSessions: Number(sessions.rows[0].count),
    totalMessages: Number(messages.rows[0].count),
    totalEvaluations: Number(evaluations.rows[0].count),
    avgScore: avgScore.rows[0].avg ? Number(avgScore.rows[0].avg) : null,
  };
}

async function getDailyUsage() {
  const result = await sql`
    SELECT
      DATE(created_at) as date,
      COUNT(*) FILTER (WHERE mode = 'chat') as chats,
      COUNT(*) FILTER (WHERE mode = 'evaluate') as evaluations
    FROM sessions
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date
  `;
  return result.rows.map((row) => ({
    date: row.date.toISOString().split("T")[0],
    chats: Number(row.chats),
    evaluations: Number(row.evaluations),
  }));
}

async function getRecentActivity() {
  const result = await sql`
    SELECT
      s.id,
      s.mode,
      s.created_at,
      COUNT(m.id) as message_count
    FROM sessions s
    LEFT JOIN messages m ON m.session_id = s.id
    GROUP BY s.id, s.mode, s.created_at
    ORDER BY s.created_at DESC
    LIMIT 10
  `;
  return result.rows;
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-zinc-900">{value}</div>
    </div>
  );
}

export default async function AdminOverview() {
  const stats = await getStats();
  const dailyUsage = await getDailyUsage();
  const recentActivity = await getRecentActivity();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-xl font-bold text-zinc-900">Overview</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Sessions" value={stats.totalSessions} />
        <StatCard label="Total Messages" value={stats.totalMessages} />
        <StatCard label="Evaluations" value={stats.totalEvaluations} />
        <StatCard
          label="Avg Score"
          value={stats.avgScore !== null ? `${stats.avgScore}` : "-"}
        />
      </div>

      {/* Usage Chart */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-700">
          Daily Usage (Last 30 Days)
        </h2>
        <UsageChart data={dailyUsage} />
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-700">
          Recent Activity
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-zinc-500">
              <th className="pb-2 font-medium">Session</th>
              <th className="pb-2 font-medium">Mode</th>
              <th className="pb-2 font-medium">Messages</th>
              <th className="pb-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {recentActivity.map((row) => (
              <tr key={row.id} className="border-b border-zinc-50">
                <td className="py-2 font-mono text-xs text-zinc-600">
                  {row.id.slice(0, 8)}...
                </td>
                <td className="py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.mode === "chat"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {row.mode}
                  </span>
                </td>
                <td className="py-2 text-zinc-600">{row.message_count}</td>
                <td className="py-2 text-zinc-500">
                  {new Date(row.created_at).toLocaleString("ja-JP")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
