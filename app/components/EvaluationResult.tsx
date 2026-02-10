"use client";

type EvaluationResultProps = {
  content: string;
  isStreaming: boolean;
};

type AxisScore = {
  label: string;
  score: number;
  max: number;
};

function parseScores(content: string): {
  total: number | null;
  axes: AxisScore[];
} {
  const totalMatch = content.match(/【総合スコア:\s*(\d+)\/100】/);
  const total = totalMatch ? parseInt(totalMatch[1], 10) : null;

  const axisPatterns = [
    { label: "売り物", pattern: /【売り物:\s*(\d+)\/20】/ },
    { label: "値付け", pattern: /【値付け:\s*(\d+)\/20】/ },
    { label: "売る人", pattern: /【売る人:\s*(\d+)\/20】/ },
    { label: "売れる仕組み", pattern: /【売れる仕組み:\s*(\d+)\/20】/ },
    { label: "売上管理", pattern: /【売上管理:\s*(\d+)\/20】/ },
  ];

  const axes: AxisScore[] = [];
  for (const { label, pattern } of axisPatterns) {
    const match = content.match(pattern);
    if (match) {
      axes.push({ label, score: parseInt(match[1], 10), max: 20 });
    }
  }

  return { total, axes };
}

function scoreColor(score: number, max: number): string {
  const ratio = score / max;
  if (ratio >= 0.8) return "bg-emerald-500";
  if (ratio >= 0.6) return "bg-blue-500";
  if (ratio >= 0.4) return "bg-amber-500";
  return "bg-red-400";
}

function totalScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 border-emerald-300 bg-emerald-50";
  if (score >= 60) return "text-blue-600 border-blue-300 bg-blue-50";
  if (score >= 40) return "text-amber-600 border-amber-300 bg-amber-50";
  return "text-red-500 border-red-300 bg-red-50";
}

export default function EvaluationResult({
  content,
  isStreaming,
}: EvaluationResultProps) {
  const { total, axes } = parseScores(content);

  // Extract text sections after scores
  const praiseMatch = content.match(/■\s*素晴らしい点\s*\n([\s\S]*?)(?=■|$)/);
  const adviceMatch = content.match(
    /■\s*100点に近づくためのアドバイス\s*\n([\s\S]*?)$/
  );

  return (
    <div className="w-full space-y-4">
      {/* Total Score */}
      {total !== null && (
        <div className="flex items-center justify-center">
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-full border-4 ${totalScoreColor(total)}`}
          >
            <div className="text-center">
              <div className="text-2xl font-bold">{total}</div>
              <div className="text-xs opacity-70">/100</div>
            </div>
          </div>
        </div>
      )}

      {/* Axis Scores */}
      {axes.length > 0 && (
        <div className="space-y-2 rounded-xl bg-zinc-50 p-4">
          {axes.map((axis) => (
            <div key={axis.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs font-medium text-zinc-600">
                {axis.label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${scoreColor(axis.score, axis.max)}`}
                  style={{ width: `${(axis.score / axis.max) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right text-xs font-semibold text-zinc-700">
                {axis.score}/{axis.max}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Praise Section */}
      {praiseMatch && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="mb-2 text-sm font-semibold text-emerald-700">
            素晴らしい点
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-emerald-800">
            {praiseMatch[1].trim()}
          </div>
        </div>
      )}

      {/* Advice Section */}
      {adviceMatch && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="mb-2 text-sm font-semibold text-blue-700">
            100点に近づくためのアドバイス
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-blue-800">
            {adviceMatch[1].trim()}
          </div>
        </div>
      )}

      {/* Fallback: show raw text if no sections parsed yet (during streaming) */}
      {axes.length === 0 && (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
          {content}
          {isStreaming && content === "" && (
            <span className="animate-pulse">評価しています...</span>
          )}
        </div>
      )}

      {isStreaming && content !== "" && axes.length > 0 && !adviceMatch && (
        <div className="animate-pulse text-sm text-zinc-400">
          評価を作成中...
        </div>
      )}
    </div>
  );
}
