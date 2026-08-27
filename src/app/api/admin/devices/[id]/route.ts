import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { removeDevice } from "@/lib/agent-auth";
import { logAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const device = await prisma.agentDevice.findUnique({ where: { id } });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  try {
    await removeDevice(id);
    await logAuditEvent({
      actorId: admin.id,
      action: "device_remove",
      targetUserId: device.userId,
      details: { serialNumber: device.serialNumber, deviceId: id },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }
}
