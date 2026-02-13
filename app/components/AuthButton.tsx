"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="h-8 w-16 animate-pulse rounded-lg bg-zinc-100" />;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/mypage"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          マイページ
        </Link>
        {session.user.image && (
          <img
            src={session.user.image}
            alt=""
            className="h-7 w-7 rounded-full border border-zinc-200"
            referrerPolicy="no-referrer"
          />
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn("google")}
      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
    >
      ログイン
    </button>
  );
}
