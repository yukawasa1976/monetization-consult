"use client";

import { useState, useRef } from "react";
import { useSession, signIn } from "next-auth/react";

export default function ConsultationForm({ onClose, variant = "consultation" }: { onClose: () => void; variant?: "consultation" | "wallhitting" }) {
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [xAccount, setXAccount] = useState("");
  const [topic, setTopic] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const isWallhitting = variant === "wallhitting";

  if (!session?.user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <h3 className="mb-3 text-lg font-semibold text-zinc-900">
            ログインが必要です
          </h3>
          <p className="mb-6 text-sm text-zinc-500">
            お申し込みにはGoogleアカウントでのログインが必要です。
          </p>
          <button
            onClick={() => signIn("google", { callbackUrl: "/?consultation=true" })}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Googleでログイン
          </button>
          <button
            onClick={onClose}
            className="mt-4 block w-full text-sm text-zinc-400 hover:text-zinc-600"
          >
            キャンセル
          </button>
        </div>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <div className="mb-4 text-4xl">✅</div>
          <h3 className="mb-2 text-lg font-semibold text-zinc-900">
            申し込みを受け付けました
          </h3>
          <p className="mb-6 text-sm text-zinc-500">
            {isWallhitting
              ? "内容を確認のうえ、川崎よりご連絡いたします。"
              : "事業計画書を確認のうえ、川崎裕一よりご連絡いたします。"}
          </p>
          <button
            onClick={onClose}
            className="rounded-xl bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            閉じる
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (isWallhitting) {
      if (!name.trim() || !topic.trim()) {
        setError("お名前と相談テーマは必須です");
        return;
      }
    } else {
      if (!name.trim() || !company.trim() || !file) {
        setError("名前、会社名、事業計画書は必須です");
        return;
      }
    }
    setError("");
    setSending(true);

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("type", variant);
      if (company.trim()) formData.append("company", company.trim());
      if (xAccount.trim()) formData.append("xAccount", xAccount.trim());
      if (topic.trim()) formData.append("topic", topic.trim());
      if (file) formData.append("file", file);

      const res = await fetch("/api/consultation", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "送信に失敗しました");
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信に失敗しました");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h3 className="mb-1 text-lg font-semibold text-zinc-900">
          {isWallhitting ? "川崎と壁打ちを申し込む" : "川崎裕一に直接相談する"}
        </h3>
        <p className="mb-6 text-sm text-zinc-500">
          {isWallhitting
            ? "AIで整理した課題を川崎本人と直接話しましょう。内容確認後にご連絡します。"
            : "事業計画書を確認のうえ、ご連絡いたします。"}
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              お名前 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田太郎"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          {!isWallhitting && (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                会社名 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="株式会社〇〇"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
              />
            </div>
          )}

          {isWallhitting && (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                相談テーマ <span className="text-red-400">*</span>
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="例：SaaSの価格設計で迷っています。フリープランの上限をどう設定すべきか…"
                rows={4}
                className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Xアカウント
            </label>
            <input
              type="text"
              value={xAccount}
              onChange={(e) => setXAccount(e.target.value)}
              placeholder="@username"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          {!isWallhitting && (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                事業計画書 <span className="text-red-400">*</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-sm text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
              >
                {file ? (
                  <span className="text-zinc-700">📎 {file.name}</span>
                ) : (
                  "PDF / Word / PowerPoint をアップロード"
                )}
              </button>
            </div>
          )}

          <div className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
            連絡先メール: {session.user.email}
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={sending}
              className="flex-1 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              {sending ? "送信中..." : "申し込む"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
