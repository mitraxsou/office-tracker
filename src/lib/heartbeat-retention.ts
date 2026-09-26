let lastPurgeAt = 0;
const PURGE_THROTTLE_MS = 60 * 60 * 1000;

export async function purgeOldHeartbeats(retentionDays: number) {
  if (retentionDays < 1) return { deleted: 0, activityTicksDeleted: 0 };

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const { prisma } = await import("./db");
  const [heartbeats, activityTicks] = await Promise.all([
    prisma.heartbeat.deleteMany({
      where: { recordedAt: { lt: cutoff } },
    }),
    prisma.activityTick.deleteMany({
      where: { at: { lt: cutoff } },
    }),
  ]);

  return {
    deleted: heartbeats.count,
    activityTicksDeleted: activityTicks.count,
  };
}

/** Throttled purge - at most once per hour per server instance. */
export async function maybePurgeOldHeartbeats(retentionDays: number) {
  const now = Date.now();
  if (now - lastPurgeAt < PURGE_THROTTLE_MS) return;
  lastPurgeAt = now;
  await purgeOldHeartbeats(retentionDays);
}
