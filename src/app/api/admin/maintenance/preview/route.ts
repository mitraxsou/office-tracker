import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  cutoffDateFromRetentionDays,
  isMaintenanceTable,
  isRetentionPeriod,
  MAINTENANCE_TABLE_LABELS,
  retentionDaysFromPeriod,
} from "@/lib/db-maintenance";
import { countRowsForPurge } from "@/lib/db-maintenance-server";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table");
  const period = searchParams.get("period");

  if (!table || !isMaintenanceTable(table)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }
  if (!period || !isRetentionPeriod(period)) {
    return NextResponse.json({ error: "Invalid retention period" }, { status: 400 });
  }

  const retentionDays = retentionDaysFromPeriod(period);
  const cutoff = cutoffDateFromRetentionDays(retentionDays);
  const count = await countRowsForPurge(table, cutoff);

  return NextResponse.json({
    table,
    tableLabel: MAINTENANCE_TABLE_LABELS[table],
    period,
    retentionDays,
    cutoff: cutoff.toISOString(),
    count,
  });
}
