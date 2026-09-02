import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit-log";
import { resetUserData } from "@/lib/user-reports";
import { isValidDayKey } from "@/lib/data-reset";
import { dayBoundsFromKey } from "@/lib/timezone-dates";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: { scope?: string; confirm?: string; fromDayKey?: string; toDayKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.confirm !== "RESET") {
    return NextResponse.json({ error: 'Type RESET to confirm' }, { status: 400 });
  }

  let range: { from: Date; to: Date } | undefined;
  if (body.fromDayKey || body.toDayKey) {
    const fromDayKey = body.fromDayKey ?? "";
    const toDayKey = body.toDayKey ?? "";
    if (!isValidDayKey(fromDayKey) || !isValidDayKey(toDayKey) || fromDayKey > toDayKey) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
    range = {
      from: dayBoundsFromKey(fromDayKey, target.timezone).start,
      to: dayBoundsFromKey(toDayKey, target.timezone).end,
    };
  }

  // Tokens and devices are only cleared by a full reset, never by a date range purge.
  const scope = !range && body.scope === "all" ? "all" : "tracking";
  const deleted = await resetUserData(id, scope, range);

  await logAuditEvent({
    actorId: admin.id,
    action: "user_data_reset",
    targetUserId: id,
    details: { scope, fromDayKey: body.fromDayKey, toDayKey: body.toDayKey, ...deleted },
  });

  return NextResponse.json({ ok: true, scope, ...deleted });
}
