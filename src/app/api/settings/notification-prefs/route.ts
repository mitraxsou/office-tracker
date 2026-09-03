import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getNotificationPrefs,
  updateNotificationPrefs,
  type NotificationPrefsData,
} from "@/lib/notification-prefs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const prefs = await getNotificationPrefs(user.id);
  return NextResponse.json({ prefs });
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
