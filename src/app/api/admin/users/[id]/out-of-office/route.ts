import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit-log";
import {
  addOutOfOfficeRange,
  clearUserOutOfOffice,
  getOutOfOfficeStatus,
  markUserOutOfOffice,
  removeOutOfOfficeRange,
} from "@/lib/out-of-office";
import { dayKeyInTimezone } from "@/lib/notification-prefs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, timezone: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const status = await getOutOfOfficeStatus(user.id, user.timezone);
  return NextResponse.json(status);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, timezone: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
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
      await addOutOfOfficeRange(user.id, startDate, endDate, "admin");
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
      await markUserOutOfOffice(user.id, dayKey, "admin");
    } else {
      return NextResponse.json(
        { error: "action must be mark, clear, add_range, or remove" },
        { status: 400 },
      );
    }

    await logAuditEvent({
      actorId: admin.id,
      action: "admin_ooo_update",
      targetUserId: user.id,
      details: { action: body.action, ...body, userEmail: user.email },
    });

    const status = await getOutOfOfficeStatus(user.id, user.timezone);
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
