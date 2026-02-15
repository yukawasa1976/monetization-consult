import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createShareToken } from "@/app/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const session = await auth();
    const userId = session?.user?.id ?? null;

    const token = await createShareToken(sessionId, userId);
    const url = `${req.nextUrl.origin}/share/${token}`;

    return NextResponse.json({ token, url });
  } catch (error) {
    console.error("Share API error:", error);
    return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
  }
}
