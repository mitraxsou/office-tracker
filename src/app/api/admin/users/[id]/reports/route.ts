import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getUserReport } from "@/lib/user-reports";
import { parseReportRange } from "@/lib/report-range";
import { currentMonthKey } from "@/lib/month-range";
import { getAppConfig, getUserHoursTarget } from "@/lib/app-config";
import { getMonthlyProgress } from "@/lib/monthly-progress";
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
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const range = parseReportRange(new URL(request.url).searchParams, user.timezone);
  const config = await getAppConfig();
  const hoursTarget = await getUserHoursTarget(user);

  const report = await getUserReport(id, range.from, range.to);
  if (!report) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const monthlyProgress = await getMonthlyProgress(
    user.id,
    user.timezone,
    hoursTarget,
    config.monthlyDaysTarget,
    new Date(),
    range.monthKey,
  );

  return NextResponse.json({
    ...report,
    hoursTarget,
    monthlyDaysTarget: config.monthlyDaysTarget,
    monthlyProgress,
    range: {
      from: range.fromKey,
      to: range.toKey,
      days: range.days,
      month: range.monthKey,
      currentMonth: currentMonthKey(user.timezone),
    },
  });
}
