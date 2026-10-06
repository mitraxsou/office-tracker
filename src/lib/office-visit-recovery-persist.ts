import { prisma } from "./db";
import { dayKeyInTimezone } from "./visits";
import { dayBoundsFromKey } from "./timezone-dates";
import {
  earliestRecoveredStartByLocalVisit,
  recoveredStartFromVisitStartPayload,
  shouldBackdateWifiVisit,
} from "./office-visit-recovery";

const LOOKBACK_MS = 48 * 60 * 60 * 1000;

/** Apply accepted visit_start timestamps that landed before server backdate existed. */
export async function persistRecoveredWifiVisitStarts(
  userId: string,
  timezone: string,
  now = new Date(),
): Promise<number> {
  const lookbackFrom = new Date(now.getTime() - LOOKBACK_MS);
  const events = await prisma.agentEvent.findMany({
    where: {
      userId,
      type: "visit_start",
      status: "accepted",
      createdAt: { gte: lookbackFrom },
    },
    select: { payload: true, deviceId: true },
    take: 80,
    orderBy: { createdAt: "desc" },
  });
  if (events.length === 0) return 0;

  const dayKey = dayKeyInTimezone(now, timezone);
  const { start: dayStart, end: dayEnd } = dayBoundsFromKey(dayKey, timezone);
  const recovered = events
    .map((row) =>
      recoveredStartFromVisitStartPayload(row.payload, { deviceId: row.deviceId }),
    )
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter((item) => item.startAt >= dayStart && item.startAt <= dayEnd);

  const byLocal = earliestRecoveredStartByLocalVisit(recovered);
  let updated = 0;

  for (const item of byLocal.values()) {
    let visit = await prisma.visit.findFirst({
      where: { userId, localVisitId: item.localVisitId },
    });
    if (!visit && item.deviceId) {
      visit = await prisma.visit.findFirst({
        where: {
          userId,
          deviceId: item.deviceId,
          endAt: null,
          source: { not: "manual" },
        },
        orderBy: { startAt: "desc" },
      });
    }
    if (!visit) continue;
    if (
      !shouldBackdateWifiVisit({
        source: visit.source,
        currentStartAt: visit.startAt,
        recoveredStartAt: item.startAt,
        endAt: visit.endAt,
        now,
      })
    ) {
      continue;
    }
    await prisma.visit.update({
      where: { id: visit.id },
      data: {
        startAt: item.startAt,
        ...(item.ssid ? { ssid: item.ssid } : {}),
      },
    });
    updated += 1;
  }

  return updated;
}
