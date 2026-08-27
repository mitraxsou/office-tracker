import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserHoursTarget } from "@/lib/app-config";
import { getTodaySummary } from "@/lib/heartbeat-service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hoursTarget = await getUserHoursTarget(user);
  const summary = await getTodaySummary(user.id, user.timezone, hoursTarget);
  return NextResponse.json(summary);
}
