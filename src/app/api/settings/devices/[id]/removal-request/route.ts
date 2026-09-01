import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit-log";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: deviceId } = await params;
  const device = await prisma.agentDevice.findFirst({
    where: { id: deviceId, userId: user.id },
  });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const existing = await prisma.deviceRemovalRequest.findFirst({
    where: { deviceId, status: "open" },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A removal request is already pending for this laptop" },
      { status: 409 },
    );
  }

  let body: { message?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const message = body.message?.trim().slice(0, 500) || null;

  const removalRequest = await prisma.deviceRemovalRequest.create({
    data: {
      userId: user.id,
      deviceId,
      message,
    },
  });

  await logAuditEvent({
    actorId: user.id,
    action: "device_removal_request",
    targetUserId: user.id,
    details: { requestId: removalRequest.id, deviceId, serialNumber: device.serialNumber },
  });

  return NextResponse.json({ request: { id: removalRequest.id } }, { status: 201 });
}
