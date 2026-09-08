import { NextResponse } from "next/server";
import {
  buildUserComplianceCsvSections,
  exportFilename,
} from "@/lib/compliance-export";
import { parseExportRange } from "@/lib/export-range";
import { csvDownloadResponse } from "@/lib/spreadsheet-export";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { getAppConfig, fiscalYearConfigFromApp } from "@/lib/app-config";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
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

  const sections = await buildUserComplianceCsvSections(userId, range);
  const { body, headers } = csvDownloadResponse(
    exportFilename(`office-pulse-${user.email.split("@")[0]}`, range),
    sections,
  );

  return new NextResponse(body, { headers });
}
