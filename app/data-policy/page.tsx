import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "データの取り扱いについて | 川崎裕一のマネタイズ相談",
  description:
    "マネタイズ相談サービスにおけるデータの取り扱い方針。会話内容・アップロードファイルの利用目的、AI学習への不使用、データ保管についてご説明します。",
};

export default function DataPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
              clipRule="evenodd"
            />
          </svg>
          相談に戻る
        </Link>

        <h1 className="mb-2 text-2xl font-bold text-zinc-900">
          データの取り扱いについて
        </h1>
        <p className="mb-12 text-sm text-zinc-400">最終更新：2026年2月16日</p>

        {/* 概要 */}
        <section className="mb-10">
          <p className="text-sm leading-relaxed text-zinc-600">
            「川崎裕一のマネタイズ相談」は、あなたの事業アイデアやビジネスモデルに関する相談をお受けするサービスです。相談内容にはビジネス上の機密情報が含まれうることを十分に理解しており、データの取り扱いには細心の注意を払っています。
          </p>
        </section>

        {/* セクション1: 利用目的 */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            あなたのデータをどう使うか
          </h2>
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4">
              <p className="mb-1 text-sm font-medium text-emerald-800">
                回答の生成
              </p>
              <p className="text-sm leading-relaxed text-emerald-700">
                入力されたメッセージやアップロードされたファイルは、AIが回答を生成するためだけに使用します。
              </p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4">
              <p className="mb-1 text-sm font-medium text-emerald-800">
                会話履歴の保存
              </p>
              <p className="text-sm leading-relaxed text-emerald-700">
                ログインユーザーの会話履歴は、マイページから確認・管理できるようにデータベースに保存します。
              </p>
            </div>
          </div>
        </section>

        {/* セクション2: しないこと */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            あなたのデータでしないこと
          </h2>
          <div className="space-y-3">
            <div className="rounded-lg border border-red-100 bg-red-50/30 p-4">
              <p className="mb-1 text-sm font-medium text-red-800">
                AIモデルの学習には使用しません
              </p>
              <p className="text-sm leading-relaxed text-red-700">
                あなたの会話内容がAIの学習データとして使われることはありません。本サービスはAnthropicのClaude
                APIを商用利用しており、商用API経由のデータはモデルの学習に使用されないことがAnthropicの利用規約で保証されています。
              </p>
            </div>
            <div className="rounded-lg border border-red-100 bg-red-50/30 p-4">
              <p className="mb-1 text-sm font-medium text-red-800">
                第三者への共有・販売はしません
              </p>
              <p className="text-sm leading-relaxed text-red-700">
                あなたの会話内容やアップロードファイルを、第三者に共有・販売・公開することはありません。
              </p>
            </div>
            <div className="rounded-lg border border-red-100 bg-red-50/30 p-4">
              <p className="mb-1 text-sm font-medium text-red-800">
                広告やマーケティングには使用しません
              </p>
              <p className="text-sm leading-relaxed text-red-700">
                あなたの相談内容を広告ターゲティングやマーケティング分析に使用することはありません。
              </p>
            </div>
          </div>
        </section>

        {/* セクション3: AI基盤の選定理由 */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            なぜClaudeを使っているのか
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-zinc-600">
            本サービスは、AIの基盤としてAnthropic社のClaude
            APIを採用しています。Anthropicを選んだ理由のひとつが、ユーザーデータの取り扱いに対する明確な姿勢です。
          </p>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-5">
            <p className="mb-3 text-sm font-medium text-zinc-800">
              Anthropicの商用APIにおけるデータポリシー：
            </p>
            <ul className="space-y-2 text-sm leading-relaxed text-zinc-600">
              <li className="flex items-start gap-2">
                <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-400" />
                商用API経由の会話データは、モデルの学習に使用しない
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-400" />
                API経由のデータは最大30日間サーバーに保持され、その後削除される
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-400" />
                ユーザーデータの売却は行わない
              </li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <a
                href="https://privacy.claude.com/en/articles/10023580-is-my-data-used-for-model-training"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 underline hover:text-zinc-700"
              >
                Anthropicのデータ学習ポリシー
              </a>
              <a
                href="https://privacy.claude.com/en/articles/10023548-how-long-do-you-store-my-data"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 underline hover:text-zinc-700"
              >
                データ保管期間について
              </a>
              <a
                href="https://www.anthropic.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 underline hover:text-zinc-700"
              >
                Anthropicプライバシーポリシー
              </a>
            </div>
          </div>
        </section>

        {/* セクション4: データの保管 */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            データの保管について
          </h2>
          <div className="space-y-4 text-sm leading-relaxed text-zinc-600">
            <div>
              <p className="mb-1 font-medium text-zinc-800">
                会話履歴（当サービスのデータベース）
              </p>
              <p>
                ログインユーザーの会話履歴は当サービスのデータベースに保存されます。マイページからいつでも確認できます。
              </p>
            </div>
            <div>
              <p className="mb-1 font-medium text-zinc-800">
                AI処理用の一時データ（Anthropicサーバー）
              </p>
              <p>
                AIが回答を生成するためにAnthropicのサーバーに送信されたデータは、最大30日間保持された後、自動的に削除されます。この間のデータはサービスの安全性維持の目的のみに限定して使用される場合があります。
              </p>
            </div>
            <div>
              <p className="mb-1 font-medium text-zinc-800">
                アップロードファイル
              </p>
              <p>
                アップロードされたファイルは回答生成のために一時的に処理され、処理完了後にサーバーから削除されます。
              </p>
            </div>
          </div>
        </section>

        {/* セクション5: ユーザーの権利 */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            あなたができること
          </h2>
          <ul className="space-y-2 text-sm leading-relaxed text-zinc-600">
            <li className="flex items-start gap-2">
              <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-400" />
              ログインせずに利用する場合、会話履歴はサーバーに保存されません
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-400" />
              ログインユーザーは、マイページで自分の会話履歴を確認・管理できます
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-zinc-400" />
              データの削除をご希望の場合は、サービス内のフィードバック機能からご連絡ください
            </li>
          </ul>
        </section>

        {/* セクション6: お問い合わせ */}
        <section className="mb-16">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            お問い合わせ
          </h2>
          <p className="text-sm leading-relaxed text-zinc-600">
            データの取り扱いについてご不明な点がございましたら、サービス内のフィードバック機能またはトップページの「直接相談する」からお問い合わせください。
          </p>
        </section>

        <div className="border-t border-zinc-100 pt-6">
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-zinc-600"
          >
            ← 相談に戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
