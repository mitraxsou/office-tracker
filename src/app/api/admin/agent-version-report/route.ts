import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { getAppConfig } from "@/lib/app-config";
import { buildAgentVersionAdminReport } from "@/lib/agent-version-report";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getAppConfig();
  const devices = await prisma.agentDevice.findMany({
    where: { uninstalledAt: null },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: [{ user: { email: "asc" } }, { serialNumber: "asc" }],
  });

  return NextResponse.json(buildAgentVersionAdminReport({ config, devices }));
}
