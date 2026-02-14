import { getFeedbacks } from "@/app/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

const categoryLabel: Record<string, string> = {
  bug: "バグ",
  improvement: "改善要望",
  other: "その他",
};

const categoryColor: Record<string, string> = {
  bug: "bg-red-100 text-red-700",
  improvement: "bg-blue-100 text-blue-700",
  other: "bg-zinc-100 text-zinc-700",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function FeedbackPage() {
  const feedbacks = await getFeedbacks();

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-zinc-900">
            フィードバック一覧
          </h1>
          <Link
            href="/admin"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-700"
          >
            ← 管理画面に戻る
          </Link>
        </div>

        {feedbacks.length === 0 ? (
          <p className="text-center text-sm text-zinc-500">
            フィードバックはまだありません。
          </p>
        ) : (
          <div className="space-y-3">
            {feedbacks.map((fb) => (
              <div
                key={fb.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-center gap-3">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${categoryColor[fb.category] || categoryColor.other}`}
                  >
                    {categoryLabel[fb.category] || fb.category}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {formatDate(fb.created_at)}
                  </span>
                  {fb.user_name && (
                    <span className="text-xs text-zinc-500">
                      {fb.user_name}
                      {fb.user_email && ` (${fb.user_email})`}
                    </span>
                  )}
                  {!fb.user_name && (
                    <span className="text-xs text-zinc-400">未ログイン</span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
                  {fb.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
