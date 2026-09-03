import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron-auth";
import { getAppConfig } from "@/lib/app-config";
import { purgeOldHeartbeats } from "@/lib/heartbeat-retention";
import { logAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const auth = authorizeCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const config = await getAppConfig();
  const { deleted } = await purgeOldHeartbeats(config.heartbeatRetentionDays);

  const breakglass = await prisma.user.findFirst({ where: { role: "admin" } });
  if (breakglass && deleted > 0) {
    await logAuditEvent({
      actorId: breakglass.id,
      action: "heartbeat_purge",
      details: { deleted, retentionDays: config.heartbeatRetentionDays },
    });
  }

  return NextResponse.json({ ok: true, deleted });
}
