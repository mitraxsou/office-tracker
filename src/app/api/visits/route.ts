import { NextResponse } from "next/server";
import { getCurrentUser, getSessionUserId } from "@/lib/auth";
import { createManualVisitRequest } from "@/lib/manual-visit-requests";
import { prisma } from "@/lib/db";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [visits, openRequests] = await Promise.all([
    prisma.visit.findMany({
      where: { userId },
      orderBy: { startAt: "desc" },
      take: 50,
    }),
    prisma.manualVisitRequest.findMany({
      where: { userId, status: "open" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    visits,
    pendingRequests: openRequests.map((r) => ({
      id: r.id,
      status: r.status,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt?.toISOString() ?? null,
      ssid: r.ssid,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { startAt?: string; endAt?: string; ssid?: string | null; message?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { startAt, endAt, ssid, message } = body;
  if (!startAt) {
    return NextResponse.json({ error: "startAt is required" }, { status: 400 });
  }

  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "Invalid startAt" }, { status: 400 });
  }

  let end: Date | null = null;
  if (endAt) {
    end = new Date(endAt);
    if (Number.isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid endAt" }, { status: 400 });
    }
  }

  const result = await createManualVisitRequest({
    userId: user.id,
    startAt: start,
    endAt: end,
    ssid,
    message,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ request: result.request }, { status: 201 });
}

export async function DELETE(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const { deleteVisitDeniedReason } = await import("@/lib/visit-actions");
  const denied = deleteVisitDeniedReason(existing, userId);
  if (denied) {
    const status = existing.userId !== userId ? 403 : 400;
    return NextResponse.json({ error: denied }, { status });
  }

  await prisma.visit.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
