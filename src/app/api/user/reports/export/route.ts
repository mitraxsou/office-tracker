import { NextResponse } from "next/server";
import {
  buildUserComplianceCsvSections,
  exportFilename,
} from "@/lib/compliance-export";
import { parseExportRange } from "@/lib/export-range";
import { csvDownloadResponse } from "@/lib/spreadsheet-export";
import { getCurrentUser } from "@/lib/auth";
import { getAppConfig, fiscalYearConfigFromApp } from "@/lib/app-config";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getAppConfig();
  const range = parseExportRange(
    new URL(request.url).searchParams,
    user.timezone,
    fiscalYearConfigFromApp(config),
  );
  if (!range) {
    return NextResponse.json({ error: "Invalid export range" }, { status: 400 });
  }

  const sections = await buildUserComplianceCsvSections(user.id, range);
  const { body, headers } = csvDownloadResponse(
    exportFilename("office-pulse-visits", range),
    sections,
  );

  return new NextResponse(body, { headers });
}
