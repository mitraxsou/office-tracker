import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { removeDeviceForUser } from "@/lib/agent-auth";
import { logAuditEvent } from "@/lib/audit-log";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const removed = await removeDeviceForUser(user.id, id);
  if (!removed) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  await logAuditEvent({
    actorId: user.id,
    action: "device_remove_self",
    targetUserId: user.id,
    details: { serialNumber: removed.serialNumber, deviceId: id },
  });

  return NextResponse.json({ ok: true });
}
