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
  // 投資評価4設問
  const [answerNonSub, setAnswerNonSub] = useState("");
  const [answerDelegation, setAnswerDelegation] = useState("");
  const [answerEconomics, setAnswerEconomics] = useState("");
  const [answerException, setAnswerException] = useState("");
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
      if (!answerNonSub.trim() || !answerDelegation.trim() || !answerEconomics.trim() || !answerException.trim()) {
        setError("4つの評価設問すべてに回答してください");
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
      if (isWallhitting) {
        formData.append("answerNonSub", answerNonSub.trim());
        formData.append("answerDelegation", answerDelegation.trim());
        formData.append("answerEconomics", answerEconomics.trim());
        formData.append("answerException", answerException.trim());
      }

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
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-8 shadow-xl">
        <h3 className="mb-1 text-lg font-semibold text-zinc-900">
          {isWallhitting ? "川崎と壁打ちを申し込む" : "川崎裕一に直接相談する"}
        </h3>
        <p className="mb-4 text-sm text-zinc-500">
          {isWallhitting
            ? "AIで整理した課題を川崎本人と直接話しましょう。内容確認後にご連絡します。"
            : "事業計画書を確認のうえ、ご連絡いたします。"}
        </p>

        {isWallhitting && (
          <div className="mb-6 rounded-xl bg-zinc-900 p-4 text-white">
            <p className="mb-2 text-sm font-semibold">投資検討の対象は「AI企業」のみです</p>
            <p className="text-xs leading-relaxed text-zinc-300">
              ここで言うAI企業とは、既存事業にAIを足した会社ではなく、AIなしでは事業が成立しない会社を指します。下記4問で「AI proof」かを自己診断してください。
            </p>
          </div>
        )}

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
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  相談テーマ <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="例：SaaSの価格設計で迷っています。フリープランの上限をどう設定すべきか…"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
                />
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-4">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">AI活用の証明（必須・4問）</p>

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    ① AI非代替性 <span className="text-red-400">*</span>
                  </label>
                  <p className="mb-1.5 text-xs text-zinc-500">AIがなければ成立しない提供価値を1つ挙げてください。人力代替した場合、何がどの水準で破綻しますか？</p>
                  <textarea
                    value={answerNonSub}
                    onChange={(e) => setAnswerNonSub(e.target.value)}
                    placeholder="例：顧客ごとの提案書を月500件生成しているが、人力では採算が合わない（1件あたり3時間、人件費換算で月450万円）"
                    rows={3}
                    className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    ② 委任深度 <span className="text-red-400">*</span>
                  </label>
                  <p className="mb-1.5 text-xs text-zinc-500">AIが判断・実行し、人間は例外のみ対応する業務フローを1つ教えてください。入力、判断、実行、介入条件まで具体的に。</p>
                  <textarea
                    value={answerDelegation}
                    onChange={(e) => setAnswerDelegation(e.target.value)}
                    placeholder="例：問い合わせ→AIが優先度判定→Tier1は自動返信・送信、Tier2のみ人間確認。介入条件は「返金」「解約」キーワード"
                    rows={3}
                    className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    ③ 運用経済性 <span className="text-red-400">*</span>
                  </label>
                  <p className="mb-1.5 text-xs text-zinc-500">AI関連の月間コストと、そのコストで生まれている主要アウトプットを教えてください。件数・売上/粗利・削減時間のいずれかも添えて。</p>
                  <textarea
                    value={answerEconomics}
                    onChange={(e) => setAnswerEconomics(e.target.value)}
                    placeholder="例：月3万円のAPIコストで提案書500件生成。同等品質を外注すると月45万円。粗利ベースで42万円/月の削減"
                    rows={3}
                    className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    ④ 例外設計 <span className="text-red-400">*</span>
                  </label>
                  <p className="mb-1.5 text-xs text-zinc-500">そのAI運用で人間が介入する割合は何％ですか？止まる条件と、復旧方法も教えてください。</p>
                  <textarea
                    value={answerException}
                    onChange={(e) => setAnswerException(e.target.value)}
                    placeholder="例：介入率5%。停止条件はAPIエラー3回連続。復旧はSlackアラート→担当者がダッシュボードから手動再送"
                    rows={3}
                    className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
                  />
                </div>
              </div>
            </>
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
