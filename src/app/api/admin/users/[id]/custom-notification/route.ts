import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit-log";
import {
  normalizeCustomMessage,
  parseCustomNotifyChannel,
  sendCustomUserNotification,
} from "@/lib/custom-notification";

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
    select: { id: true, email: true, name: true, timezone: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: { message?: unknown; channel?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = normalizeCustomMessage(body.message);
  const channel = parseCustomNotifyChannel(body.channel);
  if (!message) {
    return NextResponse.json(
      { error: "Enter a message up to 1000 characters." },
      { status: 400 },
    );
  }
  if (!channel) {
    return NextResponse.json(
      { error: "Choose in the app, Microsoft Teams, or both." },
      { status: 400 },
    );
  }

  const result = await sendCustomUserNotification(user, message, channel);
  await logAuditEvent({
    actorId: admin.id,
    action: "admin_custom_notification",
    targetUserId: user.id,
    details: {
      userEmail: user.email,
      channel,
      inApp: result.inApp,
      teamsSent: result.teams.sent,
      messagePreview: message.slice(0, 120),
    },
  });

  if (channel !== "app" && !result.teams.sent) {
    const teamsError =
      result.teams.reason === "not_configured"
        ? "Microsoft Teams is not configured. Generate a Power Automate secret and set the webhook URL."
        : "Microsoft Teams did not accept the notification.";
    if (!result.inApp) {
      return NextResponse.json({ error: teamsError }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      warning: `${teamsError} The in-app notification was still posted.`,
      ...result,
    });
  }

  return NextResponse.json({ ok: true, ...result });
}
