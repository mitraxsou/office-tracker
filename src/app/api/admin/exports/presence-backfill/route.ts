import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  buildPresenceBackfillCsv,
  buildPresenceBackfillRows,
} from "@/lib/presence-backfill-export";

export const maxDuration = 300;

/**
 * Admin-only CSV for importing users and office days into Office Presence.
 * Runs the same end-of-day close of open visits that admin compliance runs before reading days.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await buildPresenceBackfillRows();
  const body = buildPresenceBackfillCsv(rows);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="office-tracker-presence-backfill-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
