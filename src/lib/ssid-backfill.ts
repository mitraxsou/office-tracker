import { prisma } from "./db";
import { getAppConfig } from "./app-config";
import { VISIT_GAP_MS } from "./constants";
import { heartbeatInOffice } from "./heartbeat-office";
import { mergeHeartbeatsIntoVisits } from "./visits";

export type AllowlistBackfillResult = {
  heartbeatsUpdated: number;
  usersRebuilt: number;
  visitsCreated: number;
};

/** After admin adds SSIDs, retroactively fix stored heartbeats and rebuild wifi visits in retention window. */
export async function backfillHeartbeatsAndVisitsAfterAllowlistChange(
  allowlist: string[],
): Promise<AllowlistBackfillResult> {
  const config = await getAppConfig();
  const since = new Date(Date.now() - config.heartbeatRetentionDays * 24 * 60 * 60 * 1000);

  const heartbeats = await prisma.heartbeat.findMany({
    where: { recordedAt: { gte: since } },
    select: { id: true, userId: true, ssid: true, inOffice: true, recordedAt: true },
  });

  let heartbeatsUpdated = 0;
  const affectedUserIds = new Set<string>();

  for (const hb of heartbeats) {
    const shouldBeInOffice = heartbeatInOffice(hb, allowlist);
    if (shouldBeInOffice !== hb.inOffice) {
      await prisma.heartbeat.update({
        where: { id: hb.id },
        data: { inOffice: shouldBeInOffice },
      });
      heartbeatsUpdated += 1;
      affectedUserIds.add(hb.userId);
    }
  }

  let visitsCreated = 0;
  for (const userId of affectedUserIds) {
    visitsCreated += await rebuildWifiVisitsFromHeartbeats(userId, since, allowlist);
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
    ssid: h.ssid,
  }));

  const merged = mergeHeartbeatsIntoVisits(
    points.map((p) => ({ recordedAt: p.recordedAt, inOffice: p.inOffice })),
    VISIT_GAP_MS,
  );

  let created = 0;
  for (const segment of merged) {
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
        endAt: segment.endAt,
        source: "wifi",
        ssid: firstBeat?.ssid ?? null,
      },
    });
    created += 1;
  }

  return created;
}
