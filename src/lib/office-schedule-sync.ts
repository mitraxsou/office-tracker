import { prisma } from "./db";
import { dayBoundsFromKey, dayKeyInTimezone } from "./timezone-dates";
import {
  DEFAULT_NOTIFICATION_PREFS,
  getMinutesInTimezone,
  toNotificationPrefsData,
} from "./notification-prefs";
import { isDayKeyInRange } from "./out-of-office";
import {
  analyzeOfficeSchedule,
  canApplyInferredSchedule,
  inferOfficeSchedule,
  inferredScheduleEqualsPrefs,
  scheduleWindowForNow,
  type InferredOfficeSchedule,
  type OfficeScheduleInferenceAnalysis,
  type OfficeDaySample,
} from "./office-schedule";

const USER_PAGE_SIZE = 50;

/** Load visits in the window once per user. Do not loop loadDaySpanContext (it closes open visits). */

type VisitRow = {
  startAt: Date;
  endAt: Date | null;
  updatedAt: Date;
};

function visitsOverlapDay(visits: VisitRow[], dayStart: Date, dayEnd: Date): VisitRow[] {
  const startMs = dayStart.getTime();
  const endMs = dayEnd.getTime();
  return visits.filter((v) => {
    if (v.startAt.getTime() > endMs) return false;
    const visitEnd = (v.endAt ?? v.updatedAt).getTime();
    return visitEnd >= startMs;
  });
}

function sampleForDay(
  dayKey: string,
  timezone: string,
  visits: VisitRow[],
  lastInOfficeHeartbeatAt: Date | null,
): OfficeDaySample | null {
  const { start: dayStart, end: dayEnd } = dayBoundsFromKey(dayKey, timezone);
  const overlapping = visitsOverlapDay(visits, dayStart, dayEnd);
  if (overlapping.length === 0) return null;

  let firstIn: Date | null = null;
  let lastClosedOut: Date | null = null;
  let hadOpen = false;

  for (const visit of overlapping) {
    const startMs = Math.max(visit.startAt.getTime(), dayStart.getTime());
    if (startMs > dayEnd.getTime()) continue;
    if (!firstIn || startMs < firstIn.getTime()) firstIn = new Date(startMs);

    if (visit.endAt) {
      const endMs = Math.min(visit.endAt.getTime(), dayEnd.getTime());
      if (endMs >= dayStart.getTime() && (!lastClosedOut || endMs > lastClosedOut.getTime())) {
        lastClosedOut = new Date(endMs);
      }
    } else {
      hadOpen = true;
    }
  }

  if (!firstIn) return null;

  let lastOutMinutes: number | null = null;
  if (hadOpen) {
    if (lastInOfficeHeartbeatAt) {
      const hbMs = Math.min(
        Math.max(lastInOfficeHeartbeatAt.getTime(), dayStart.getTime()),
        dayEnd.getTime(),
      );
      const fromHb = new Date(hbMs);
      const fromClosed = lastClosedOut;
      const lastOut =
        fromClosed && fromClosed.getTime() > fromHb.getTime() ? fromClosed : fromHb;
      lastOutMinutes = getMinutesInTimezone(lastOut, timezone);
    }
  } else if (lastClosedOut) {
    lastOutMinutes = getMinutesInTimezone(lastClosedOut, timezone);
  }

  return {
    dayKey,
    firstInMinutes: getMinutesInTimezone(firstIn, timezone),
    lastOutMinutes,
  };
}

async function loadOfficeDaySamples(
  userId: string,
  timezone: string,
  startDayKey: string,
  endDayKey: string,
): Promise<OfficeDaySample[]> {
  const windowStart = dayBoundsFromKey(startDayKey, timezone).start;
  const windowEnd = dayBoundsFromKey(endDayKey, timezone).end;

  const [visits, oooRows, heartbeats] = await Promise.all([
    prisma.visit.findMany({
      where: {
        userId,
        startAt: { lte: windowEnd },
        OR: [{ endAt: null }, { endAt: { gte: windowStart } }],
      },
      select: { startAt: true, endAt: true, updatedAt: true },
      orderBy: { startAt: "asc" },
    }),
    prisma.userOutOfOffice.findMany({
      where: {
        userId,
        startDate: { lte: endDayKey },
        endDate: { gte: startDayKey },
      },
      select: { startDate: true, endDate: true },
    }),
    prisma.heartbeat.findMany({
      where: {
        userId,
        inOffice: true,
        recordedAt: { gte: windowStart, lte: windowEnd },
      },
      select: { recordedAt: true },
      orderBy: { recordedAt: "asc" },
    }),
  ]);

  const lastHbByDay = new Map<string, Date>();
  for (const beat of heartbeats) {
    const key = dayKeyInTimezone(beat.recordedAt, timezone);
    lastHbByDay.set(key, beat.recordedAt);
  }

  const samples: OfficeDaySample[] = [];
  let dayKey = startDayKey;
  while (dayKey <= endDayKey) {
    const ooo = oooRows.some((row) => isDayKeyInRange(dayKey, row.startDate, row.endDate));
    if (!ooo) {
      const sample = sampleForDay(dayKey, timezone, visits, lastHbByDay.get(dayKey) ?? null);
      if (sample) samples.push(sample);
    }
    const [y, m, d] = dayKey.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    dayKey = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  }

  return samples;
}

export async function inferScheduleForUser(
  userId: string,
  timezone: string,
  now = new Date(),
): Promise<InferredOfficeSchedule | null> {
  const todayKey = dayKeyInTimezone(now, timezone);
  const { startDayKey, endDayKey } = scheduleWindowForNow(todayKey);
  if (endDayKey < startDayKey) return null;
  const samples = await loadOfficeDaySamples(userId, timezone, startDayKey, endDayKey);
  return inferOfficeSchedule({ samples, windowStartDayKey: startDayKey, windowEndDayKey: endDayKey });
}

export type OfficeScheduleSuggestionResult = OfficeScheduleInferenceAnalysis & {
  status: "suggestion" | "insufficient_history" | "matches_current";
  suggestion: InferredOfficeSchedule | null;
  windowStartDayKey: string;
  windowEndDayKey: string;
};

export async function analyzeScheduleForUser(
  userId: string,
  timezone: string,
  prefs: { workDays: number[]; officeStartTime: string; officeEndTime: string },
  now = new Date(),
): Promise<OfficeScheduleSuggestionResult> {
  const todayKey = dayKeyInTimezone(now, timezone);
  const { startDayKey, endDayKey } = scheduleWindowForNow(todayKey);
  const samples = await loadOfficeDaySamples(userId, timezone, startDayKey, endDayKey);
  const analysis = analyzeOfficeSchedule({
    samples,
    windowStartDayKey: startDayKey,
    windowEndDayKey: endDayKey,
  });

  if (!analysis.inferred) {
    return {
      ...analysis,
      status: "insufficient_history",
      suggestion: null,
      windowStartDayKey: startDayKey,
      windowEndDayKey: endDayKey,
    };
  }

  const matchesCurrent = inferredScheduleEqualsPrefs(analysis.inferred, prefs);
  return {
    ...analysis,
    status: matchesCurrent ? "matches_current" : "suggestion",
    suggestion: matchesCurrent ? null : analysis.inferred,
    windowStartDayKey: startDayKey,
    windowEndDayKey: endDayKey,
  };
}

export async function getOfficeScheduleSuggestion(
  userId: string,
  timezone: string,
  prefs: { workDays: number[]; officeStartTime: string; officeEndTime: string },
  now = new Date(),
): Promise<InferredOfficeSchedule | null> {
  const analysis = await analyzeScheduleForUser(userId, timezone, prefs, now);
  return analysis.suggestion;
}

export async function applyInferredOfficeSchedule(
  userId: string,
  inferred: InferredOfficeSchedule,
) {
  await prisma.userNotificationPrefs.upsert({
    where: { userId },
    create: {
      userId,
      workDays: JSON.stringify(inferred.workDays),
      officeStartTime: inferred.officeStartTime,
      officeEndTime: inferred.officeEndTime ?? undefined,
      scheduleAutoFilled: true,
      scheduleUserSet: false,
    },
    update: {
      workDays: JSON.stringify(inferred.workDays),
      officeStartTime: inferred.officeStartTime,
      ...(inferred.officeEndTime ? { officeEndTime: inferred.officeEndTime } : {}),
      scheduleAutoFilled: true,
      scheduleUserSet: false,
    },
  });
}

export async function syncOfficeSchedulesFromHistory(now = new Date()) {
  let scanned = 0;
  let updated = 0;
  let skippedUserSet = 0;
  let skippedLittleData = 0;
  let skippedCustom = 0;
  let unchanged = 0;
  let cursor: string | undefined;

  for (;;) {
    const users = await prisma.user.findMany({
      take: USER_PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        timezone: true,
        notificationPrefs: true,
      },
    });
    if (users.length === 0) break;

    for (const user of users) {
      scanned += 1;
      const prefsRow = user.notificationPrefs;
      const parsed = prefsRow ? toNotificationPrefsData(prefsRow) : DEFAULT_NOTIFICATION_PREFS;
      const decision = {
        scheduleUserSet: prefsRow?.scheduleUserSet ?? false,
        scheduleAutoFilled: prefsRow?.scheduleAutoFilled ?? false,
        workDays: parsed.workDays,
        officeStartTime: parsed.officeStartTime,
        officeEndTime: parsed.officeEndTime,
      };

      if (decision.scheduleUserSet) {
        skippedUserSet += 1;
        continue;
      }
      if (!canApplyInferredSchedule(decision)) {
        skippedCustom += 1;
        continue;
      }

      const inferred = await inferScheduleForUser(user.id, user.timezone, now);
      if (!inferred) {
        skippedLittleData += 1;
        continue;
      }

      if (inferredScheduleEqualsPrefs(inferred, decision)) {
        if (!decision.scheduleAutoFilled) {
          await prisma.userNotificationPrefs.upsert({
            where: { userId: user.id },
            create: {
              userId: user.id,
              workDays: JSON.stringify(inferred.workDays),
              officeStartTime: inferred.officeStartTime,
              officeEndTime: inferred.officeEndTime ?? decision.officeEndTime,
              scheduleAutoFilled: true,
              scheduleUserSet: false,
            },
            update: { scheduleAutoFilled: true, scheduleUserSet: false },
          });
        }
        unchanged += 1;
        continue;
      }

      await applyInferredOfficeSchedule(user.id, inferred);
      updated += 1;
    }

    cursor = users[users.length - 1]?.id;
    if (users.length < USER_PAGE_SIZE) break;
  }

  const summary = {
    scanned,
    updated,
    unchanged,
    skippedUserSet,
    skippedLittleData,
    skippedCustom,
  };
  console.info("[office-schedule cron]", summary);
  return summary;
}
