import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  clearUserOutOfOffice,
  getOutOfOfficeStatus,
  markUserOutOfOffice,
} from "@/lib/out-of-office";
import { dayKeyInTimezone } from "@/lib/notification-prefs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = await getOutOfOfficeStatus(user.id, user.timezone);
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { action?: string; dayKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dayKey =
    body.dayKey?.trim() || dayKeyInTimezone(new Date(), user.timezone);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    return NextResponse.json({ error: "Invalid dayKey" }, { status: 400 });
  }

  try {
    if (body.action === "clear") {
      await clearUserOutOfOffice(user.id, dayKey);
    } else if (body.action === "mark") {
      await markUserOutOfOffice(user.id, dayKey, "settings");
    } else {
      return NextResponse.json({ error: "action must be mark or clear" }, { status: 400 });
    }
    const status = await getOutOfOfficeStatus(user.id, user.timezone);
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
