import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAppConfig } from "@/lib/app-config";
import { getUserPresenceTimeline } from "@/lib/presence-timeline";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, timezone: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const search = new URL(request.url).searchParams;
  const dayKey = search.get("date");
  const daysParam = Number.parseInt(search.get("days") ?? "7", 10);
  const days = Number.isFinite(daysParam) ? daysParam : 7;

  const config = await getAppConfig();
  const timeline = await getUserPresenceTimeline(
    user.id,
    days,
    user.timezone,
    config.officeSsids,
    { dayKey },
  );

  return NextResponse.json(timeline);
}
