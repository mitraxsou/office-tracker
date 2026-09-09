import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { reopenAdminContactThread } from "@/lib/admin-contact";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const result = await reopenAdminContactThread({
    threadId: id,
    actorId: admin.id,
    actorRole: "admin",
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ thread: result.thread });
}
