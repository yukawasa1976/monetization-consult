"use client";

import { useState } from "react";

type Category = "bug" | "improvement" | "other";

const categories: { value: Category; label: string }[] = [
  { value: "bug", label: "バグ" },
  { value: "improvement", label: "改善要望" },
  { value: "other", label: "その他" },
];

export default function FeedbackButton({
  sessionId,
}: {
  sessionId: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<Category>("improvement");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSending(true);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, content: content.trim(), sessionId }),
      });

      if (!res.ok) throw new Error("送信に失敗しました");
      setSent(true);
    } catch {
      alert("送信に失敗しました。もう一度お試しください。");
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    if (sent) {
      setContent("");
      setCategory("improvement");
      setSent(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-700 text-white shadow-lg transition-all hover:bg-zinc-600 hover:shadow-xl"
        title="フィードバックを送る"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5"
        >
          <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
          <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
        </svg>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 sm:items-center">
          <div className="mb-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:mb-0">
            {sent ? (
              <div className="text-center">
                <div className="mb-3 text-3xl">&#x2705;</div>
                <h3 className="mb-2 text-lg font-semibold text-zinc-900">
                  送信しました！
                </h3>
                <p className="mb-5 text-sm text-zinc-500">
                  フィードバックありがとうございます。改善に活かします。
                </p>
                <button
                  onClick={handleClose}
                  className="rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
                >
                  閉じる
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-zinc-900">
                    フィードバック
                  </h3>
                  <button
                    onClick={handleClose}
                    className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-5 w-5"
                    >
                      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                    </svg>
                  </button>
                </div>

                <div className="mb-4 flex gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        category === cat.value
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="気になった点や要望を教えてください..."
                  rows={4}
                  className="mb-4 w-full resize-none rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
                />

                <button
                  onClick={handleSubmit}
                  disabled={!content.trim() || sending}
                  className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40"
                >
                  {sending ? "送信中..." : "送信する"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
