import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getSessionMessages } from "@/app/lib/db";
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

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const messages = await getSessionMessages(id, session.user.id);

  if (messages.length === 0) {
    return (
      <div className="px-4 py-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-zinc-500">
            このセッションは見つかりませんでした。
          </p>
          <Link
            href="/mypage"
            className="mt-4 inline-block text-sm text-zinc-600 underline"
          >
            マイページに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/mypage"
          className="mb-6 inline-block text-sm text-zinc-500 transition-colors hover:text-zinc-700"
        >
          ← マイページに戻る
        </Link>

        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "max-w-[85%] bg-zinc-900 text-white"
                    : "max-w-[85%] border border-zinc-100 bg-white text-zinc-800 shadow-sm"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="mb-1 text-xs font-semibold text-zinc-500">
                    川崎裕一
                  </div>
                )}
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {msg.content}
                </div>
                <div
                  className={`mt-1 text-right text-xs ${
                    msg.role === "user" ? "text-zinc-400" : "text-zinc-300"
                  }`}
                >
                  {formatDate(msg.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
