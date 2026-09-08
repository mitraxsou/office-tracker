import { NextResponse } from "next/server";
import {
  buildOrgComplianceCsvSections,
  exportFilename,
} from "@/lib/compliance-export";
import { parseExportRange } from "@/lib/export-range";
import { csvDownloadResponse } from "@/lib/spreadsheet-export";
import { requireAdmin } from "@/lib/admin";
import { getAppConfig, fiscalYearConfigFromApp } from "@/lib/app-config";
export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const timezone = "Asia/Kolkata";
  const config = await getAppConfig();
  const range = parseExportRange(
    new URL(request.url).searchParams,
    timezone,
    fiscalYearConfigFromApp(config),
  );
  if (!range) {
    return NextResponse.json(
      { error: "Invalid export range. Use month=YYYY-MM or fy=YYYY-YY." },
      { status: 400 },
    );
  }

  const sections = await buildOrgComplianceCsvSections(range, timezone);
  const { body, headers } = csvDownloadResponse(
    exportFilename("office-pulse-org", range),
    sections,
  );

  return new NextResponse(body, { headers });
}
