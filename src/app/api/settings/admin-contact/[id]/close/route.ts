import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { closeAdminContactThread } from "@/lib/admin-contact-server";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await closeAdminContactThread({
    threadId: id,
    actorId: user.id,
    actorRole: "user",
    threadUserId: user.id,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ thread: result.thread });
}
