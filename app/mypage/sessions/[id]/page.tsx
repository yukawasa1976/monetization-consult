import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getSessionMessages } from "@/app/lib/db";
import Link from "next/link";
import CopyButton from "@/app/components/CopyButton";

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
                  className={`mt-1 flex items-center ${
                    msg.role === "user" ? "justify-end" : "justify-between"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <CopyButton text={msg.content} />
                  )}
                  <span className={`text-xs ${msg.role === "user" ? "text-zinc-400" : "text-zinc-300"}`}>
                    {formatDate(msg.created_at)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href={`/?session=${id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-md transition-colors hover:bg-blue-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 0 0 1.33 0l1.713-3.293a.783.783 0 0 1 .642-.413 41.102 41.102 0 0 0 3.55-.414c1.437-.231 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0 0 10 2ZM6.75 6a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 2.5a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z" clipRule="evenodd" />
            </svg>
            この会話を続ける
          </Link>
        </div>
      </div>
    </div>
  );
}
