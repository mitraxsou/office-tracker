import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { createManualVisit } from "@/lib/heartbeat-service";
import { logAuditEvent } from "@/lib/audit-log";
import { validateVisitTimestamps } from "@/lib/visit-validation";

const MAX_BULK_DELETE = 500;

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
  if (!userId || !startAt) {
    return NextResponse.json({ error: "userId and startAt required" }, { status: 400 });
  }

  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "Invalid startAt" }, { status: 400 });
  }

  let end: Date | null = null;
  if (endAt) {
    end = new Date(endAt);
    if (Number.isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: "Invalid endAt" }, { status: 400 });
    }
  }

  const timestampError = validateVisitTimestamps(start, end);
  if (timestampError) {
    return NextResponse.json({ error: timestampError }, { status: 400 });
  }

  try {
    const visit = await createManualVisit({ userId, startAt: start, endAt: end, ssid: ssid ?? null });

    await logAuditEvent({
      actorId: admin.id,
      action: "visit_create",
      targetUserId: userId,
      details: { visitId: visit.id, startAt, endAt },
    });

    return NextResponse.json({ visit }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create visit";
    return NextResponse.json({ error: message }, { status: 400 });
  }
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

  const nextStart = (data.startAt as Date | undefined) ?? existing.startAt;
  const nextEnd = (data.endAt as Date | null | undefined) ?? existing.endAt;
  if (Number.isNaN(nextStart.getTime())) {
    return NextResponse.json({ error: "Invalid startAt" }, { status: 400 });
  }
  if (nextEnd && (Number.isNaN(nextEnd.getTime()) || nextEnd <= nextStart)) {
    return NextResponse.json({ error: "Check-out must be after check-in" }, { status: 400 });
  }

  const timestampError = validateVisitTimestamps(nextStart, nextEnd);
  if (timestampError) {
    return NextResponse.json({ error: timestampError }, { status: 400 });
  }

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
  const idsParam = searchParams.get("ids");
  const singleId = searchParams.get("id");
  const ids = (idsParam ? idsParam.split(",") : singleId ? [singleId] : [])
    .map((value) => value.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ error: "id or ids required" }, { status: 400 });
  }
  if (ids.length > MAX_BULK_DELETE) {
    return NextResponse.json(
      { error: `Select ${MAX_BULK_DELETE} visits or fewer` },
      { status: 400 },
    );
  }

  const existing = await prisma.visit.findMany({
    where: { id: { in: ids } },
    select: { id: true, userId: true },
  });
  if (existing.length === 0) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }

  const result = await prisma.visit.deleteMany({
    where: { id: { in: existing.map((v) => v.id) } },
  });

  await logAuditEvent({
    actorId: admin.id,
    action: "visit_delete",
    targetUserId: existing[0].userId,
    details: { visitIds: existing.map((v) => v.id), deleted: result.count },
  });

  return NextResponse.json({ ok: true, deleted: result.count });
}
