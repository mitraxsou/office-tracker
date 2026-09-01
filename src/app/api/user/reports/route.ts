import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserHoursTarget } from "@/lib/app-config";
import { getUserReport } from "@/lib/user-reports";
import { parseReportRange } from "@/lib/report-range";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const range = parseReportRange(new URL(request.url).searchParams, user.timezone);
  const hoursTarget = await getUserHoursTarget(user);

  const report = await getUserReport(user.id, range.from, range.to);
  if (!report) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...report,
    hoursTarget,
    range: {
      days: range.days,
      from: range.fromKey,
      to: range.toKey,
    },
  });
}
