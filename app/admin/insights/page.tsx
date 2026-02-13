import { sql } from "@vercel/postgres";

export const dynamic = "force-dynamic";

async function getInsights() {
  const result = await sql`
    SELECT *
    FROM insights
    ORDER BY week_start DESC
    LIMIT 20
  `;
  return result.rows;
}

export default async function InsightsPage() {
  const insights = await getInsights();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-xl font-bold text-zinc-900">Weekly Insights</h1>

      {insights.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center">
          <p className="text-sm text-zinc-500">
            No insights yet. The weekly analysis cron job will generate insights
            automatically.
          </p>
        </div>
      ) : (
        insights.map((insight) => (
          <div
            key={insight.id}
            className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-800">
                  Week of{" "}
                  {new Date(insight.week_start).toLocaleDateString("ja-JP")}
                </h2>
                <p className="text-xs text-zinc-500">
                  {new Date(insight.created_at).toLocaleString("ja-JP")}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  insight.auto_applied
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {insight.auto_applied ? "Applied" : "Pending"}
              </span>
            </div>

            {/* Analysis */}
            <div>
              <h3 className="mb-1 text-xs font-medium text-zinc-500">
                Analysis
              </h3>
              <div className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
                {insight.analysis}
              </div>
            </div>

            {/* FAQ Additions */}
            {insight.faq_additions && (
              <div>
                <h3 className="mb-1 text-xs font-medium text-zinc-500">
                  FAQ Additions
                </h3>
                <div className="whitespace-pre-wrap rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                  {insight.faq_additions}
                </div>
              </div>
            )}

            {/* Prompt Suggestions */}
            {insight.prompt_suggestions && (
              <div>
                <h3 className="mb-1 text-xs font-medium text-zinc-500">
                  Prompt Suggestions
                </h3>
                <div className="whitespace-pre-wrap rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  {insight.prompt_suggestions}
                </div>
              </div>
            )}

            {/* Knowledge Gaps */}
            {insight.knowledge_gaps && (
              <div>
                <h3 className="mb-1 text-xs font-medium text-zinc-500">
                  Knowledge Gaps
                </h3>
                <div className="whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-sm text-red-800">
                  {insight.knowledge_gaps}
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
