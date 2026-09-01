import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { logAuditEvent } from "@/lib/audit-log";
import {
  cutoffDateFromRetentionDays,
  isMaintenanceTable,
  isRetentionPeriod,
  MAINTENANCE_TABLE_LABELS,
  purgeTableRows,
  retentionDaysFromPeriod,
} from "@/lib/db-maintenance";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { table?: string; period?: string; confirm?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.table || !isMaintenanceTable(body.table)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }
  if (!body.period || !isRetentionPeriod(body.period)) {
    return NextResponse.json({ error: "Invalid retention period" }, { status: 400 });
  }
  if (body.confirm !== "DELETE") {
    return NextResponse.json(
      { error: 'Confirmation required. Send { "confirm": "DELETE" }.' },
      { status: 400 },
    );
  }

  const retentionDays = retentionDaysFromPeriod(body.period);
  const cutoff = cutoffDateFromRetentionDays(retentionDays);
  const result = await purgeTableRows(body.table, cutoff);

  await logAuditEvent({
    actorId: admin.id,
    action: "data_purge",
    details: {
      table: body.table,
      tableLabel: MAINTENANCE_TABLE_LABELS[body.table],
      period: body.period,
      retentionDays,
      cutoff: cutoff.toISOString(),
      deleted: result.deleted,
    },
  });

  return NextResponse.json({
    ok: true,
    table: body.table,
    deleted: result.deleted,
    cutoff: cutoff.toISOString(),
  });
}
