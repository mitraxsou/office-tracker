import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getTodaySummary } from "@/lib/heartbeat-service";
import { getUserHoursTarget } from "@/lib/app-config";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hoursTarget = await getUserHoursTarget(user);
  const summary = await getTodaySummary(user.id, user.timezone, hoursTarget);

  const pendingTokens = user.agentTokens.filter((t) => !t.boundSerialNumber).length;
  const boundTokens = user.agentTokens.filter((t) => t.boundSerialNumber).length;

  let installStatus: "not_installed" | "waiting" | "connected" = "not_installed";
  if (user.agentDevices.length > 0 && summary.agentHealthy) {
    installStatus = "connected";
  } else if (user.agentDevices.length > 0) {
    installStatus = "waiting";
  } else if (user.agentTokens.length > 0) {
    installStatus = "waiting";
  }

  return NextResponse.json({
    installStatus,
    agentHealthy: summary.agentHealthy,
    lastHeartbeat: summary.lastHeartbeat?.recordedAt?.toISOString() ?? null,
    inOfficeNow: summary.inOfficeNow,
    deviceCount: user.agentDevices.length,
    pendingTokens,
    boundTokens,
    devices: user.agentDevices.map((d) => ({
      id: d.id,
      serialNumber: d.serialNumber,
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
    })),
  });
}
