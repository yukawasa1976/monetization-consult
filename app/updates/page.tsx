import Link from "next/link";
import type { Metadata } from "next";
import FeedbackBox from "./FeedbackBox";
import updatesData from "./updates.json";

export const metadata: Metadata = {
  title: "アップデート履歴 | 川崎裕一のマネタイズ相談",
  description:
    "マネタイズ相談サービスのアップデート履歴。新機能・改善・セキュリティ対応の記録です。",
};

type Tag = "new" | "improve" | "security" | "fix";

const tagConfig: Record<Tag, { label: string; className: string }> = {
  new: { label: "NEW", className: "bg-emerald-100 text-emerald-700" },
  improve: { label: "改善", className: "bg-blue-100 text-blue-700" },
  security: {
    label: "セキュリティ",
    className: "bg-amber-100 text-amber-700",
  },
  fix: { label: "修正", className: "bg-zinc-100 text-zinc-600" },
};

export default function UpdatesPage() {
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
          アップデート履歴
        </h1>
        <p className="mb-12 text-sm text-zinc-400">
          サービスの改善・新機能・セキュリティ対応の記録です
        </p>

        <div className="mb-10">
          <FeedbackBox />
        </div>

        <div className="relative space-y-0">
          {/* Timeline line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-zinc-200" />

          {updatesData.map((update, i) => (
            <div key={update.date} className="relative pb-10 pl-8 last:pb-0">
              {/* Timeline dot */}
              <div
                className={`absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-2 ${
                  i === 0
                    ? "border-zinc-900 bg-zinc-900"
                    : "border-zinc-300 bg-white"
                }`}
              />

              <p className="mb-1 text-sm font-medium text-zinc-400">
                {update.date}
              </p>
              <h2 className="mb-4 text-lg font-semibold text-zinc-900">
                {update.title}
              </h2>
              <ul className="space-y-2.5">
                {update.items.map((item, j) => {
                  const tag = tagConfig[item.tag as Tag] ?? tagConfig.improve;
                  return (
                    <li key={j} className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold leading-tight ${tag.className}`}
                      >
                        {tag.label}
                      </span>
                      <span className="text-sm leading-relaxed text-zinc-600">
                        {item.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-zinc-100 pt-6">
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
