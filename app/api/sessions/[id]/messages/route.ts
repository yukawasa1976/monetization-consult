import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSessionMessages } from "@/app/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const messages = await getSessionMessages(id, session.user.id);

  return NextResponse.json({
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });
}
