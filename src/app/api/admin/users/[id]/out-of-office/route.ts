import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit-log";
import {
  clearUserOutOfOffice,
  getOutOfOfficeStatus,
  markUserOutOfOffice,
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
      await markUserOutOfOffice(user.id, dayKey, "admin");
    } else {
      return NextResponse.json({ error: "action must be mark or clear" }, { status: 400 });
    }

    await logAuditEvent({
      actorId: admin.id,
      action: "admin_ooo_update",
      targetUserId: user.id,
      details: { action: body.action, dayKey, userEmail: user.email },
    });

    const status = await getOutOfOfficeStatus(user.id, user.timezone);
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
