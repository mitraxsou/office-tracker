import { prisma } from "./db";
import { getAppConfig } from "./app-config";
import { normalizeSsid, VISIT_GAP_MS } from "./constants";
import { heartbeatInOffice } from "./heartbeat-office";
import { mergeHeartbeatsIntoVisits } from "./visits";

export type AllowlistBackfillResult = {
  heartbeatsUpdated: number;
  usersRebuilt: number;
  visitsCreated: number;
};

/** True when stored heartbeats no longer match the current allowlist or SSID normalization rules. */
export async function hasHeartbeatAllowlistMismatches(
  allowlist: string[],
  retentionDays: number,
): Promise<boolean> {
  const since = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const heartbeats = await prisma.heartbeat.findMany({
    where: { recordedAt: { gte: since } },
    select: { ssid: true, inOffice: true },
    take: 1000,
  });

  return heartbeats.some(
    (hb) =>
      (hb.ssid !== null && normalizeSsid(hb.ssid) !== hb.ssid) ||
      heartbeatInOffice(hb, allowlist) !== hb.inOffice,
  );
}

/** After admin adds SSIDs, retroactively fix stored heartbeats and rebuild wifi visits in retention window. */
export async function backfillHeartbeatsAndVisitsAfterAllowlistChange(
  allowlist: string[],
): Promise<AllowlistBackfillResult> {
  const config = await getAppConfig();
  const since = new Date(Date.now() - config.heartbeatRetentionDays * 24 * 60 * 60 * 1000);
  const staleMs = config.agentStaleMinutes * 60 * 1000;

  const heartbeats = await prisma.heartbeat.findMany({
    where: { recordedAt: { gte: since } },
    select: { id: true, userId: true, ssid: true, inOffice: true, recordedAt: true },
  });

  let heartbeatsUpdated = 0;
  const affectedUserIds = new Set<string>();

  for (const hb of heartbeats) {
    const normalizedSsid = hb.ssid ? normalizeSsid(hb.ssid) : null;
    const shouldBeInOffice = heartbeatInOffice(
      { ssid: normalizedSsid, inOffice: hb.inOffice },
      allowlist,
    );
    const needsUpdate =
      shouldBeInOffice !== hb.inOffice || (hb.ssid !== null && normalizedSsid !== hb.ssid);

    if (needsUpdate) {
      await prisma.heartbeat.update({
        where: { id: hb.id },
        data: { inOffice: shouldBeInOffice, ssid: normalizedSsid },
      });
      heartbeatsUpdated += 1;
      affectedUserIds.add(hb.userId);
    }
  }

  let visitsCreated = 0;
  for (const userId of affectedUserIds) {
    visitsCreated += await rebuildWifiVisitsFromHeartbeats(userId, since, allowlist, staleMs);
  }

  return {
    heartbeatsUpdated,
    usersRebuilt: affectedUserIds.size,
    visitsCreated,
  };
}

async function rebuildWifiVisitsFromHeartbeats(
  userId: string,
  since: Date,
  allowlist: string[],
  staleMs: number,
): Promise<number> {
  await prisma.visit.deleteMany({
    where: {
      userId,
      source: "wifi",
      OR: [{ startAt: { gte: since } }, { endAt: null }],
    },
  });

  const heartbeats = await prisma.heartbeat.findMany({
    where: { userId, recordedAt: { gte: since } },
    orderBy: { recordedAt: "asc" },
    select: { recordedAt: true, ssid: true, inOffice: true },
  });

  if (heartbeats.length === 0) return 0;

  const points = heartbeats.map((h) => ({
    recordedAt: h.recordedAt,
    inOffice: heartbeatInOffice(h, allowlist),
    ssid: h.ssid ? normalizeSsid(h.ssid) : null,
  }));

  const merged = mergeHeartbeatsIntoVisits(
    points.map((p) => ({ recordedAt: p.recordedAt, inOffice: p.inOffice })),
    VISIT_GAP_MS,
  );

  const now = Date.now();
  const lastPoint = points[points.length - 1];
  let created = 0;

  for (let i = 0; i < merged.length; i++) {
    const segment = merged[i];
    const isLast = i === merged.length - 1;
    const leaveOpen =
      isLast &&
      lastPoint.inOffice &&
      now - lastPoint.recordedAt.getTime() <= staleMs;

    const firstBeat = points.find(
      (p) =>
        p.inOffice &&
        p.recordedAt.getTime() >= segment.startAt.getTime() &&
        p.recordedAt.getTime() <= segment.endAt.getTime(),
    );

    await prisma.visit.create({
      data: {
        userId,
        startAt: segment.startAt,
        endAt: leaveOpen ? null : segment.endAt,
        source: "wifi",
        ssid: firstBeat?.ssid ?? null,
      },
    });
    created += 1;
  }

  return created;
}
