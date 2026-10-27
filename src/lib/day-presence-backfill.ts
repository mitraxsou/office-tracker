import { getUserHoursTarget } from "./app-config";
import { prisma } from "./db";
import { loadDaySpanContext } from "./heartbeat-service";
import { dayKeyInTimezone, daySpanMsForDay } from "./visits";

export type DayPresenceBackfillResult = {
  usersScanned: number;
  userDaysTouched: number;
  summariesUpserted: number;
  /** Days with office presence below the daily hours target (now count toward monthly goal). */
  presenceUnderTargetDays: number;
  /** Days with office presence at or above the daily hours target. */
  hoursMetDays: number;
};

function dayKeysTouchedByVisits(
  visits: Array<{ startAt: Date; endAt: Date | null }>,
  timezone: string,
  now: Date,
): string[] {
  const keys = new Set<string>();
  for (const visit of visits) {
    const end = visit.endAt ?? now;
    // Walk calendar days from start day through end day (cap 4 days for runaway open visits).
    let cursor = new Date(visit.startAt.getTime());
    for (let i = 0; i < 4; i++) {
      const key = dayKeyInTimezone(cursor, timezone);
      keys.add(key);
      if (dayKeyInTimezone(end, timezone) <= key) break;
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
  }
  return [...keys].sort();
}

/**
 * Recompute DailySummary.officeMs from Visit day spans for all users (or one user).
 * Monthly day counting is on-read from visits; this keeps DailySummary aligned and
 * reports how many presence-under-target days now count toward the monthly goal.
 */
export async function recomputeDayPresenceFromVisits(options?: {
  userId?: string;
  now?: Date;
}): Promise<DayPresenceBackfillResult> {
  const now = options?.now ?? new Date();
  const users = await prisma.user.findMany({
    where: options?.userId ? { id: options.userId } : undefined,
    select: { id: true, timezone: true, hoursTarget: true },
    orderBy: { email: "asc" },
  });

  let userDaysTouched = 0;
  let summariesUpserted = 0;
  let presenceUnderTargetDays = 0;
  let hoursMetDays = 0;

  for (const user of users) {
    const hoursTarget = await getUserHoursTarget(user);
    const visits = await prisma.visit.findMany({
      where: { userId: user.id },
      select: { startAt: true, endAt: true },
      orderBy: { startAt: "asc" },
    });
    if (visits.length === 0) continue;

    const dayKeys = dayKeysTouchedByVisits(visits, user.timezone, now);
    for (const dayKey of dayKeys) {
      userDaysTouched += 1;
      const { visits: dayVisits, params } = await loadDaySpanContext(
        user.id,
        dayKey,
        user.timezone,
        { skipMaintenance: true },
      );
      const officeMs = Math.round(daySpanMsForDay(dayVisits, params));
      const hours = officeMs / (1000 * 60 * 60);
      if (hours > 0 && hours < hoursTarget) presenceUnderTargetDays += 1;
      if (hours >= hoursTarget) hoursMetDays += 1;

      const closedEnds = dayVisits
        .filter((v) => v.endAt)
        .map((v) => v.endAt as Date)
        .sort((a, b) => a.getTime() - b.getTime());
      const firstCheckIn = dayVisits
        .map((v) => v.startAt)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      const lastCheckOut = closedEnds.length > 0 ? closedEnds[closedEnds.length - 1] : null;

      await prisma.dailySummary.upsert({
        where: { userId_dayKey: { userId: user.id, dayKey } },
        create: {
          userId: user.id,
          dayKey,
          officeMs,
          visitCount: dayVisits.length,
          firstCheckInAt: firstCheckIn ?? null,
          lastCheckOutAt: lastCheckOut,
          source: "admin_recompute",
          verified: true,
        },
        update: {
          officeMs,
          visitCount: dayVisits.length,
          firstCheckInAt: firstCheckIn ?? null,
          lastCheckOutAt: lastCheckOut,
          source: "admin_recompute",
          verified: true,
        },
      });
      summariesUpserted += 1;
    }
  }

  return {
    usersScanned: users.length,
    userDaysTouched,
    summariesUpserted,
    presenceUnderTargetDays,
    hoursMetDays,
  };
}
