import Link from "next/link";
import { signOut } from "@/auth";

export default function MyPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-zinc-500 transition-colors hover:text-zinc-700"
            >
              ← 相談に戻る
            </Link>
            <h1 className="text-lg font-bold text-zinc-900">マイページ</h1>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50"
            >
              ログアウト
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
