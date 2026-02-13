import { sql } from "@vercel/postgres";
import Link from "next/link";
import ScoreDistChart from "../components/ScoreDistChart";

export const dynamic = "force-dynamic";

async function getEvaluations() {
  const result = await sql`
    SELECT
      e.id,
      e.session_id,
      e.score_total,
      e.score_product,
      e.score_pricing,
      e.score_sales,
      e.score_scale,
      e.score_finance,
      e.plan_text,
      e.created_at
    FROM evaluations e
    ORDER BY e.created_at DESC
    LIMIT 100
  `;
  return result.rows;
}

async function getScoreDistribution() {
  const result = await sql`
    SELECT
      CASE
        WHEN score_total BETWEEN 0 AND 19 THEN '0-19'
        WHEN score_total BETWEEN 20 AND 39 THEN '20-39'
        WHEN score_total BETWEEN 40 AND 59 THEN '40-59'
        WHEN score_total BETWEEN 60 AND 79 THEN '60-79'
        WHEN score_total BETWEEN 80 AND 100 THEN '80-100'
      END as range,
      COUNT(*) as count
    FROM evaluations
    WHERE score_total IS NOT NULL
    GROUP BY range
    ORDER BY range
  `;
  return result.rows.map((r) => ({
    range: r.range as string,
    count: Number(r.count),
  }));
}

export default async function EvaluationsPage() {
  const [evaluations, distribution] = await Promise.all([
    getEvaluations(),
    getScoreDistribution(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-xl font-bold text-zinc-900">Evaluations</h1>

      {/* Score Distribution */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-700">
          Score Distribution
        </h2>
        <ScoreDistChart data={distribution} />
      </div>

      {/* Evaluations Table */}
      <div className="rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-zinc-500">
              <th className="px-4 py-3 font-medium">Session</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">売り物</th>
              <th className="px-4 py-3 font-medium">値付け</th>
              <th className="px-4 py-3 font-medium">売る人</th>
              <th className="px-4 py-3 font-medium">仕組み</th>
              <th className="px-4 py-3 font-medium">管理</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map((e) => (
              <tr
                key={e.id}
                className="border-b border-zinc-50 transition-colors hover:bg-zinc-50"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/sessions/${e.session_id}`}
                    className="font-mono text-xs text-blue-600 hover:underline"
                  >
                    {e.session_id.slice(0, 8)}...
                  </Link>
                </td>
                <td className="px-4 py-3 font-semibold text-zinc-900">
                  {e.score_total ?? "-"}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {e.score_product ?? "-"}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {e.score_pricing ?? "-"}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {e.score_sales ?? "-"}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {e.score_scale ?? "-"}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {e.score_finance ?? "-"}
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-xs text-zinc-500">
                  {e.plan_text?.slice(0, 80) ?? "-"}
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {new Date(e.created_at).toLocaleDateString("ja-JP")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
