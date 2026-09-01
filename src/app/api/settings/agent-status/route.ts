import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getTodaySummary, getPulseStats } from "@/lib/heartbeat-service";
import { getAppConfig, getUserHoursTarget } from "@/lib/app-config";
import { isTokenExpired } from "@/lib/token-expiry";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getAppConfig();
  const hoursTarget = await getUserHoursTarget(user);
  const summary = await getTodaySummary(user.id, user.timezone, hoursTarget);
  const pulse = await getPulseStats(user.id, config.agentStaleMinutes);

  const pendingTokens = user.agentTokens.filter(
    (t) => !t.boundSerialNumber && !isTokenExpired(t),
  ).length;
  const boundTokens = user.agentTokens.filter((t) => t.boundSerialNumber).length;

  let installStatus: "not_installed" | "waiting" | "connected" = "not_installed";
  if (user.agentDevices.length > 0 && pulse.agentHealthy) {
    installStatus = "connected";
  } else if (user.agentDevices.length > 0) {
    installStatus = "waiting";
  } else if (pendingTokens > 0) {
    installStatus = "waiting";
  }

  let pulseStatus: "healthy" | "stale" | "none" = "none";
  if (pulse.lastHeartbeat) {
    pulseStatus = pulse.agentHealthy ? "healthy" : "stale";
  }

  return NextResponse.json({
    installStatus,
    agentHealthy: pulse.agentHealthy,
    pulseStatus,
    lastHeartbeat: pulse.lastHeartbeat,
    inOfficeNow: summary.inOfficeNow,
    deviceCount: user.agentDevices.length,
    pendingTokens,
    boundTokens,
    pulsesLast24h: pulse.pulsesLast24h,
    expectedPulsesPerDay: pulse.expectedPulsesPerDay,
    minutesSinceLastPulse: pulse.minutesSinceLastPulse,
    recentPulses: pulse.recentPulses,
    devices: user.agentDevices.map((d) => ({
      id: d.id,
      serialNumber: d.serialNumber,
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
    })),
  });
}
