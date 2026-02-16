"use client";

import { useState } from "react";

export default function FeedbackBox() {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "improvement",
          content: content.trim(),
          sessionId: null,
        }),
      });
      if (res.ok) {
        setSent(true);
        setContent("");
      }
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-5 py-4 text-center">
        <p className="text-sm font-medium text-emerald-700">
          ありがとうございます！いただいたご意見は今後の改善に活かします。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-5">
      <p className="mb-1 text-sm font-medium text-zinc-800">
        「こんな機能がほしい」はありますか？
      </p>
      <p className="mb-4 text-xs text-zinc-400">
        いただいた声をもとに改善を続けています
      </p>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="例：過去の相談を検索できるようにしてほしい"
        rows={2}
        className="mb-3 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 placeholder-zinc-300 focus:border-zinc-400 focus:outline-none"
      />
      <button
        onClick={handleSubmit}
        disabled={!content.trim() || sending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40"
      >
        {sending ? "送信中..." : "送信する"}
      </button>
    </div>
  );
}
