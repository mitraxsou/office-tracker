import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  addOutOfOfficeRange,
  clearUserOutOfOffice,
  getOutOfOfficeStatus,
  markUserOutOfOffice,
  removeOutOfOfficeRange,
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

  let body: {
    action?: string;
    dayKey?: string;
    startDate?: string;
    endDate?: string;
    rangeId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (body.action === "add_range") {
      const startDate = body.startDate?.trim();
      const endDate = body.endDate?.trim();
      if (!startDate || !endDate) {
        return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
      }
      await addOutOfOfficeRange(user.id, startDate, endDate, "settings");
    } else if (body.action === "remove") {
      if (!body.rangeId?.trim()) {
        return NextResponse.json({ error: "rangeId is required" }, { status: 400 });
      }
      await removeOutOfOfficeRange(user.id, body.rangeId.trim());
    } else if (body.action === "clear") {
      const dayKey =
        body.dayKey?.trim() || dayKeyInTimezone(new Date(), user.timezone);
      await clearUserOutOfOffice(user.id, dayKey);
    } else if (body.action === "mark") {
      const dayKey =
        body.dayKey?.trim() || dayKeyInTimezone(new Date(), user.timezone);
      await markUserOutOfOffice(user.id, dayKey, "settings");
    } else {
      return NextResponse.json(
        { error: "action must be mark, clear, add_range, or remove" },
        { status: 400 },
      );
    }
    const status = await getOutOfOfficeStatus(user.id, user.timezone);
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
