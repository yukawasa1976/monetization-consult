import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserSessions, getUserEvaluations } from "@/app/lib/db";
import Link from "next/link";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(text: string | null, maxLen: number) {
  if (!text) return "（内容なし）";
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

function scoreColor(score: number | null) {
  if (score === null) return "text-zinc-400";
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-blue-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

export default async function MyPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [sessions, evaluations] = await Promise.all([
    getUserSessions(session.user.id),
    getUserEvaluations(session.user.id),
  ]);

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* ユーザー情報 */}
        <div className="flex items-center gap-3">
          {session.user.image && (
            <img
              src={session.user.image}
              alt=""
              className="h-12 w-12 rounded-full border border-zinc-200"
              referrerPolicy="no-referrer"
            />
          )}
          <div>
            <p className="font-semibold text-zinc-900">{session.user.name}</p>
            <p className="text-sm text-zinc-500">{session.user.email}</p>
          </div>
        </div>

        {/* チャット履歴 */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-zinc-900">
            チャット履歴
          </h2>
          {sessions.filter((s) => s.mode === "chat").length === 0 ? (
            <p className="text-sm text-zinc-400">
              まだチャット履歴はありません。
              <Link href="/" className="text-zinc-600 underline">
                相談してみましょう
              </Link>
            </p>
          ) : (
            <div className="space-y-2">
              {sessions
                .filter((s) => s.mode === "chat")
                .map((s) => (
                  <Link
                    key={s.id}
                    href={`/mypage/sessions/${s.id}`}
                    className="block rounded-lg border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p className="flex-1 text-sm text-zinc-800">
                        {truncate(s.first_message, 80)}
                      </p>
                      <span className="shrink-0 text-xs text-zinc-400">
                        {s.message_count}件
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">
                      {formatDate(s.created_at)}
                    </p>
                  </Link>
                ))}
            </div>
          )}
        </section>

        {/* 評価履歴 */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-zinc-900">
            事業計画評価
          </h2>
          {evaluations.length === 0 ? (
            <p className="text-sm text-zinc-400">
              まだ評価履歴はありません。
            </p>
          ) : (
            <div className="space-y-2">
              {evaluations.map((e) => (
                <Link
                  key={e.id}
                  href={`/mypage/sessions/${e.session_id}`}
                  className="block rounded-lg border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="flex-1 text-sm text-zinc-800">
                      {truncate(e.plan_text, 80)}
                    </p>
                    <span
                      className={`shrink-0 text-lg font-bold ${scoreColor(e.score_total)}`}
                    >
                      {e.score_total ?? "??"}/100
                    </span>
                  </div>
                  <div className="mt-2 flex gap-3 text-xs text-zinc-400">
                    <span>売り物 {e.score_product}/20</span>
                    <span>値付け {e.score_pricing}/20</span>
                    <span>売る人 {e.score_sales}/20</span>
                    <span>仕組み {e.score_scale}/20</span>
                    <span>管理 {e.score_finance}/20</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    {formatDate(e.created_at)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
