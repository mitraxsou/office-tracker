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
  if (!startAt || !endAt) {
    return NextResponse.json({ error: "startAt and endAt are required" }, { status: 400 });
  }

  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
  }
  if (end <= start) {
    return NextResponse.json({ error: "endAt must be after startAt" }, { status: 400 });
  }

  const visit = await createManualVisit({
    userId: user.id,
    startAt: start,
    endAt: end,
    ssid: ssid ?? null,
  });

  return NextResponse.json({ visit }, { status: 201 });
}
