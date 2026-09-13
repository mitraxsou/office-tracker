import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { getNotificationPrefs } from "@/lib/notification-prefs-server";
import { analyzeScheduleForUser } from "@/lib/office-schedule-sync";

export async function GET(
  _request: Request,
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

  const prefs = await getNotificationPrefs(user.id);
  const analysis = await analyzeScheduleForUser(user.id, user.timezone, prefs);
  return NextResponse.json({ analysis });
}
