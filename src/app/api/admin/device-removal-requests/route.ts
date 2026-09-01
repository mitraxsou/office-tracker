import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { removeDevice } from "@/lib/agent-auth";
import { recordAgentUninstall } from "@/lib/agent-lifecycle";
import { logAuditEvent } from "@/lib/audit-log";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "open";
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));

  const requests = await prisma.deviceRemovalRequest.findMany({
    where: status === "all" ? undefined : { status },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: { select: { id: true, email: true, name: true } },
      device: { select: { id: true, serialNumber: true, lastSeenAt: true } },
      resolvedBy: { select: { email: true } },
    },
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      status: r.status,
      message: r.message,
      adminNote: r.adminNote,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      user: r.user,
      device: {
        id: r.device.id,
        serialNumber: r.device.serialNumber,
        lastSeenAt: r.device.lastSeenAt?.toISOString() ?? null,
      },
      resolvedByEmail: r.resolvedBy?.email ?? null,
    })),
  });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { id?: string; status?: string; adminNote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const status = body.status ?? "approved";
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json({ error: "status must be approved or rejected" }, { status: 400 });
  }

  const existing = await prisma.deviceRemovalRequest.findUnique({
    where: { id: body.id },
    include: { device: true, user: { select: { id: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (existing.status !== "open") {
    return NextResponse.json({ error: "Request is already resolved" }, { status: 400 });
  }

  const adminNote =
    body.adminNote !== undefined ? body.adminNote.trim().slice(0, 2000) || null : null;

  if (status === "approved") {
    try {
      await recordAgentUninstall({
        userId: existing.user.id,
        deviceId: existing.deviceId,
        serialNumber: existing.device.serialNumber,
        source: "admin",
        metadata: { via: "removal_request", requestId: existing.id },
      });
      await removeDevice(existing.deviceId);
      await logAuditEvent({
        actorId: admin.id,
        action: "device_remove",
        targetUserId: existing.user.id,
        details: {
          serialNumber: existing.device.serialNumber,
          deviceId: existing.deviceId,
          via: "removal_request",
          requestId: existing.id,
        },
      });
    } catch {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }
  }

  const updated = await prisma.deviceRemovalRequest.update({
    where: { id: existing.id },
    data: {
      status,
      adminNote,
      resolvedAt: new Date(),
      resolvedById: admin.id,
    },
  });

  await logAuditEvent({
    actorId: admin.id,
    action: status === "approved" ? "device_removal_approve" : "device_removal_reject",
    targetUserId: existing.user.id,
    details: {
      requestId: updated.id,
      deviceId: existing.deviceId,
      serialNumber: existing.device.serialNumber,
      adminNote,
    },
  });

  return NextResponse.json({
    request: {
      id: updated.id,
      status: updated.status,
      adminNote: updated.adminNote,
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
    },
  });
}
