import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dismissAllUnreadInAppNotifications } from "@/lib/in-app-notifications";

/** POST: mark all unread in-app notifications as read for the session user. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dismissed = await dismissAllUnreadInAppNotifications(user.id);
  return NextResponse.json({ ok: true, dismissed });
}
