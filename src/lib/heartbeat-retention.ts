let lastPurgeAt = 0;
const PURGE_THROTTLE_MS = 60 * 60 * 1000;

export async function purgeOldHeartbeats(retentionDays: number) {
  if (retentionDays < 1) return { deleted: 0 };

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const { prisma } = await import("./db");
  const result = await prisma.heartbeat.deleteMany({
    where: { recordedAt: { lt: cutoff } },
  });

  return { deleted: result.count };
}

/** Throttled purge — at most once per hour per server instance. */
export async function maybePurgeOldHeartbeats(retentionDays: number) {
  const now = Date.now();
  if (now - lastPurgeAt < PURGE_THROTTLE_MS) return;
  lastPurgeAt = now;
  await purgeOldHeartbeats(retentionDays);
}
