import { sql } from "@vercel/postgres";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getSessions(page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;
  const [rows, countResult] = await Promise.all([
    sql`
      SELECT
        s.id,
        s.ip,
        s.mode,
        s.user_agent,
        s.created_at,
        s.updated_at,
        COUNT(m.id) as message_count
      FROM sessions s
      LEFT JOIN messages m ON m.session_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    sql`SELECT COUNT(*) as count FROM sessions`,
  ]);

  return {
    sessions: rows.rows,
    total: Number(countResult.rows[0].count),
  };
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const pageSize = 20;
  const { sessions, total } = await getSessions(page, pageSize);
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Sessions</h1>
        <span className="text-sm text-zinc-500">{total} total</span>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-zinc-500">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Mode</th>
              <th className="px-4 py-3 font-medium">IP</th>
              <th className="px-4 py-3 font-medium">Messages</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr
                key={s.id}
                className="border-b border-zinc-50 transition-colors hover:bg-zinc-50"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/sessions/${s.id}`}
                    className="font-mono text-xs text-blue-600 hover:underline"
                  >
                    {s.id.slice(0, 8)}...
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.mode === "chat"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {s.mode}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                  {s.ip ?? "-"}
                </td>
                <td className="px-4 py-3 text-zinc-600">{s.message_count}</td>
                <td className="px-4 py-3 text-zinc-500">
                  {new Date(s.created_at).toLocaleString("ja-JP")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/admin/sessions?page=${page - 1}`}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-zinc-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/sessions?page=${page + 1}`}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
