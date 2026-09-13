import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getNotificationPrefs } from "@/lib/notification-prefs-server";
import { analyzeScheduleForUser } from "@/lib/office-schedule-sync";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prefs = await getNotificationPrefs(user.id);
  const analysis = await analyzeScheduleForUser(user.id, user.timezone, prefs);
  return NextResponse.json({ analysis });
}
