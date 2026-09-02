import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit-log";
import {
  getNotificationPrefs,
  updateNotificationPrefs,
  type NotificationPrefsData,
} from "@/lib/notification-prefs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const prefs = await getNotificationPrefs(user.id);
  return NextResponse.json({ prefs });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return patchNotificationPrefs(request, params);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return patchNotificationPrefs(request, params);
}

async function patchNotificationPrefs(
  request: Request,
  params: Promise<{ id: string }>,
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: Partial<NotificationPrefsData>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const prefs = await updateNotificationPrefs(user.id, body);
    await logAuditEvent({
      actorId: admin.id,
      action: "admin_notification_prefs_update",
      targetUserId: user.id,
      details: { userEmail: user.email, fields: Object.keys(body) },
    });
    return NextResponse.json({ prefs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
