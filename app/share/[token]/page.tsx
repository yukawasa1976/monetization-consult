import { getShareMessages } from "@/app/lib/db";
import { notFound } from "next/navigation";
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

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // UUID形式チェック
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) {
    notFound();
  }

  const messages = await getShareMessages(token);

  if (messages.length === 0) {
    notFound();
  }

  return (
    <div className="min-h-dvh bg-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-lg font-bold text-zinc-900">
            川崎裕一のマネタイズ相談
          </h1>
          <p className="text-sm text-zinc-500">共有された会話</p>
        </div>
      </header>

      {/* Messages */}
      <div className="px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-4">
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

      {/* CTA */}
      <div className="border-t border-zinc-200 bg-white px-4 py-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-sm text-zinc-600">
            インターネットサービスの収益化について、AIがアドバイスします
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            自分も相談してみる →
          </Link>
        </div>
      </div>
    </div>
  );
}
