import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserSessions } from "@/app/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await getUserSessions(session.user.id, 5);
  return NextResponse.json({ sessions });
}
