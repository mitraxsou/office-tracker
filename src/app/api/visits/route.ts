import { NextResponse } from "next/server";
import { getCurrentUser, getSessionUserId } from "@/lib/auth";
import { createManualVisit } from "@/lib/heartbeat-service";
import { prisma } from "@/lib/db";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const visits = await prisma.visit.findMany({
    where: { userId },
    orderBy: { startAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ visits });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { startAt?: string; endAt?: string; ssid?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { startAt, endAt, ssid } = body;
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
    if (Number.isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: "Invalid endAt" }, { status: 400 });
    }
  }

  const resolvedSsid = typeof ssid === "string" && ssid.trim() ? ssid.trim() : "manual";

  const visit = await createManualVisit({
    userId: user.id,
    startAt: start,
    endAt: end,
    ssid: resolvedSsid,
  });

  return NextResponse.json({ visit }, { status: 201 });
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
