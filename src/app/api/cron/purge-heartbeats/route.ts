import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/app-config";
import { purgeOldHeartbeats } from "@/lib/heartbeat-retention";
import { logAuditEvent } from "@/lib/audit-log";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
