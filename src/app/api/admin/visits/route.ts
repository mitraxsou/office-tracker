import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { createManualVisit } from "@/lib/heartbeat-service";
import { logAuditEvent } from "@/lib/audit-log";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: {
    userId: string;
    startAt?: { lte: Date };
    OR?: Array<{ endAt: null } | { endAt: { gte: Date } }>;
  } = { userId };

  if (to) {
    where.startAt = { lte: new Date(to) };
  }
  if (from) {
    where.OR = [{ endAt: null }, { endAt: { gte: new Date(from) } }];
  }

  const visits = await prisma.visit.findMany({
    where,
    orderBy: { startAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    visits: visits.map((v) => ({
      id: v.id,
      userId: v.userId,
      startAt: v.startAt.toISOString(),
      endAt: v.endAt?.toISOString() ?? null,
      source: v.source,
      ssid: v.ssid,
    })),
  });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    userId?: string;
    startAt?: string;
    endAt?: string;
    ssid?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, startAt, endAt, ssid } = body;
  if (!userId || !startAt || !endAt) {
    return NextResponse.json({ error: "userId, startAt, endAt required" }, { status: 400 });
  }

  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
  }

  const visit = await createManualVisit({ userId, startAt: start, endAt: end, ssid: ssid ?? null });

  await logAuditEvent({
    actorId: admin.id,
    action: "visit_create",
    targetUserId: userId,
    details: { visitId: visit.id, startAt, endAt },
  });

  return NextResponse.json({ visit }, { status: 201 });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { id?: string; startAt?: string; endAt?: string | null; ssid?: string | null };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const existing = await prisma.visit.findUnique({ where: { id: body.id } });
  if (!existing) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (body.startAt) data.startAt = new Date(body.startAt);
  if (body.endAt !== undefined) data.endAt = body.endAt ? new Date(body.endAt) : null;
  if (body.ssid !== undefined) data.ssid = body.ssid;

  const visit = await prisma.visit.update({
    where: { id: body.id },
    data,
  });

  await logAuditEvent({
    actorId: admin.id,
    action: "visit_update",
    targetUserId: existing.userId,
    details: { visitId: body.id, changes: body },
  });

  return NextResponse.json({ visit });
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const existing = await prisma.visit.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }

  await prisma.visit.delete({ where: { id } });

  await logAuditEvent({
    actorId: admin.id,
    action: "visit_delete",
    targetUserId: existing.userId,
    details: { visitId: id },
  });

  return NextResponse.json({ ok: true });
}
