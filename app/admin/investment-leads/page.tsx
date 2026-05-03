import { getInvestmentLeads, getInvestmentLeadStats } from "@/app/lib/db";

export const dynamic = "force-dynamic";

const LEVEL_STYLE: Record<string, string> = {
  PRIORITY: "bg-red-50 text-red-700 border border-red-200",
  GO: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  HOLD: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  NG: "bg-zinc-100 text-zinc-500",
};

export default async function InvestmentLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const { level } = await searchParams;
  const [leads, stats] = await Promise.all([
    getInvestmentLeads(level, 50, 0),
    getInvestmentLeadStats(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Investment Leads</h1>
        <p className="text-sm text-zinc-500">認知コストゼロ設計の証明スクリーニング</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total", value: Number(stats.total), color: "text-zinc-900" },
          { label: "PRIORITY", value: Number(stats.priority), color: "text-red-600" },
          { label: "GO", value: Number(stats.go), color: "text-emerald-600" },
          { label: "HOLD", value: Number(stats.hold), color: "text-yellow-600" },
          { label: "Avg Score", value: stats.avg_score ? `${stats.avg_score}pt` : "-", color: "text-zinc-900" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-200 bg-white p-4 text-center">
            <div className="text-xs text-zinc-500">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[undefined, "PRIORITY", "GO", "HOLD", "NG"].map((l) => (
          <a
            key={l ?? "all"}
            href={l ? `?level=${l}` : "?"}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              level === l || (!level && !l)
                ? "bg-zinc-900 text-white"
                : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {l ?? "All"}
          </a>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        {leads.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-400">
            申し込みはまだありません
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50">
              <tr className="text-left text-xs text-zinc-500">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Level</th>
                <th className="px-4 py-3 font-medium">Email / X</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                  <td className="px-4 py-3 font-medium text-zinc-900">{lead.name}</td>
                  <td className="px-4 py-3 text-zinc-700 font-mono">{lead.score}pt</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${LEVEL_STYLE[lead.level]}`}>
                      {lead.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    <div>{lead.email}</div>
                    {lead.x_account && (
                      <div className="text-xs text-zinc-400">{lead.x_account}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {new Date(lead.created_at).toLocaleString("ja-JP")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Answers Detail */}
      {leads.filter((l) => l.level === "PRIORITY" || l.level === "GO").length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-700">GO / PRIORITY 回答詳細</h2>
          {leads
            .filter((l) => l.level === "PRIORITY" || l.level === "GO")
            .map((lead) => (
              <div key={`detail-${lead.id}`} className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-zinc-900">{lead.name}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${LEVEL_STYLE[lead.level]}`}>
                    {lead.level} {lead.score}pt
                  </span>
                </div>
                {Object.entries({
                  "① 非代替性": lead.answers.nonSubstitutability,
                  "② 委任深度": lead.answers.delegation,
                  "③ 運用経済性": lead.answers.economics,
                  "④ 例外設計": lead.answers.exceptionOps,
                }).map(([label, text]) => (
                  <div key={label}>
                    <div className="text-xs font-medium text-zinc-500 mb-0.5">{label}</div>
                    <div className="text-sm text-zinc-700 whitespace-pre-wrap">{text as string}</div>
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
