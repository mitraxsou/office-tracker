import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { requestAgentUpdateForUser } from "@/lib/agent-update";
import { logAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const count = await requestAgentUpdateForUser(id);

  await logAuditEvent({
    actorId: admin.id,
    action: "agent_update_push",
    targetUserId: id,
    details: { deviceCount: count },
  });

  return NextResponse.json({ ok: true, deviceCount: count });
}
