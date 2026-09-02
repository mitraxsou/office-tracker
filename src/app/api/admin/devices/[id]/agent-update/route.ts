import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { requestAgentUpdateForDevice } from "@/lib/agent-update";
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
  const device = await prisma.agentDevice.findUnique({ where: { id } });
  if (!device || device.uninstalledAt) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  await requestAgentUpdateForDevice(id);

  await logAuditEvent({
    actorId: admin.id,
    action: "agent_update_push",
    targetUserId: device.userId,
    details: { deviceId: id, serialNumber: device.serialNumber },
  });

  return NextResponse.json({ ok: true });
}
