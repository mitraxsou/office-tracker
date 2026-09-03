import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getNotificationPrefs,
  updateNotificationPrefs,
  type NotificationPrefsData,
} from "@/lib/notification-prefs";
import { getOfficeScheduleSuggestion } from "@/lib/office-schedule-sync";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const prefs = await getNotificationPrefs(user.id);
  const suggestion = await getOfficeScheduleSuggestion(user.id, user.timezone, prefs);
  return NextResponse.json({ prefs, suggestion });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<NotificationPrefsData>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const prefs = await updateNotificationPrefs(user.id, body);
    return NextResponse.json({ prefs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
