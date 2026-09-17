import { prisma } from "./db";
import { AGENT_API_ROUTES } from "./agent-api-hits";
import { getAgentVersion } from "./agent-version";
import { dayKeyInTimezone } from "./timezone-dates";

export type UserAgentActivityDeviceRow = {
  id: string;
  serialNumber: string;
  label: string | null;
  tokenPrefix: string | null;
  agentScriptVersion: string | null;
  lastSeenAt: string | null;
  hitsToday: {
    sync: number;
    heartbeat: number;
    config: number;
    total: number;
  };
};

export type UserAgentActivitySnapshot = {
  serverAgentVersion: string;
  timezone: string;
  dayKey: string;
  devices: UserAgentActivityDeviceRow[];
};

export async function getUserAgentActivitySnapshot(
  userId: string,
  timezone: string,
): Promise<UserAgentActivitySnapshot> {
  const dayKey = dayKeyInTimezone(new Date(), timezone);
  const [devices, hitRows] = await Promise.all([
    prisma.agentDevice.findMany({
      where: { userId, uninstalledAt: null },
      orderBy: { lastSeenAt: "desc" },
      select: {
        id: true,
        serialNumber: true,
        label: true,
        agentScriptVersion: true,
        lastSeenAt: true,
        agentToken: { select: { tokenPrefix: true } },
      },
    }),
    prisma.agentApiHitDaily.findMany({
      where: { userId, dayKey },
      select: { deviceId: true, route: true, hitCount: true },
    }),
  ]);

  const hitsByDevice = new Map<string, { sync: number; heartbeat: number; config: number }>();
  for (const row of hitRows) {
    const bucket = hitsByDevice.get(row.deviceId) ?? { sync: 0, heartbeat: 0, config: 0 };
    if (row.route === AGENT_API_ROUTES.SYNC) bucket.sync += row.hitCount;
    else if (row.route === AGENT_API_ROUTES.HEARTBEAT) bucket.heartbeat += row.hitCount;
    else if (row.route === AGENT_API_ROUTES.CONFIG) bucket.config += row.hitCount;
    hitsByDevice.set(row.deviceId, bucket);
  }

  return {
    serverAgentVersion: getAgentVersion(),
    timezone,
    dayKey,
    devices: devices.map((d) => {
      const h = hitsByDevice.get(d.id) ?? { sync: 0, heartbeat: 0, config: 0 };
      return {
        id: d.id,
        serialNumber: d.serialNumber,
        label: d.label,
        tokenPrefix: d.agentToken?.tokenPrefix ?? null,
        agentScriptVersion: d.agentScriptVersion,
        lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
        hitsToday: {
          ...h,
          total: h.sync + h.heartbeat + h.config,
        },
      };
    }),
  };
}
