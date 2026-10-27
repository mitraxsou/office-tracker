import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { logAuditEvent } from "@/lib/audit-log";
import { recomputeDayPresenceFromVisits } from "@/lib/day-presence-backfill";

/**
 * Admin-only: recompute DailySummary office presence from Visit history.
 * Monthly qualifying days are derived on-read from visits (any presence counts).
 * Run this on Vercel after deploy so DailySummary stays aligned; do not run against
 * production Postgres from a local workspace.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let userId: string | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as { userId?: string };
    if (typeof body.userId === "string" && body.userId.trim()) {
      userId = body.userId.trim();
    }
  } catch {
    // empty body is fine (all users)
  }

  const result = await recomputeDayPresenceFromVisits({ userId });

  await logAuditEvent({
    actorId: admin.id,
    action: "day_presence_recompute",
    targetUserId: userId ?? null,
    details: { ...result, scope: userId ? "user" : "all" },
  });

  return NextResponse.json({ ok: true, ...result });
}
