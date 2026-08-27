import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminReports } from "@/lib/admin-reports";
import { getRecentAuditLogs } from "@/lib/audit-log";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [reports, auditLog] = await Promise.all([
    getAdminReports(),
    getRecentAuditLogs(25),
  ]);

  return NextResponse.json({ ...reports, auditLog });
}
