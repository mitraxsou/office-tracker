import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminReports } from "@/lib/admin-reports";
import { getRecentAuditLogs } from "@/lib/audit-log";
import { parseReportRange } from "@/lib/report-range";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const range = parseReportRange(new URL(request.url).searchParams);

  const [reports, auditLog] = await Promise.all([
    getAdminReports({ days: range.days }),
    getRecentAuditLogs(25),
  ]);

  return NextResponse.json({
    ...reports,
    range: {
      days: range.days,
      from: range.fromKey,
      to: range.toKey,
    },
    auditLog,
    actor: { id: admin.id, email: admin.email },
  });
}
