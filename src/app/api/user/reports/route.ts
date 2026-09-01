import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserHoursTarget, getAppConfig } from "@/lib/app-config";
import { getUserReport } from "@/lib/user-reports";
import { getMonthlyProgress } from "@/lib/monthly-progress";
import { parseReportRange } from "@/lib/report-range";
import { currentMonthKey } from "@/lib/month-range";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const range = parseReportRange(new URL(request.url).searchParams, user.timezone);
  const config = await getAppConfig();
  const hoursTarget = await getUserHoursTarget(user);

  const report = await getUserReport(user.id, range.from, range.to);
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
      days: range.days,
      from: range.fromKey,
      to: range.toKey,
      month: range.monthKey,
      currentMonth: currentMonthKey(user.timezone),
    },
  });
}
