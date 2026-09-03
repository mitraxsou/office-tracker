import { DEFAULT_NOTIFICATION_PREFS, DEFAULT_WORK_DAYS } from "./notification-prefs";

/** Last ~8 calendar weeks of office days (exclude today, which is still in progress). */
export const OFFICE_SCHEDULE_WINDOW_DAYS = 56;

/** Include a weekday if it has at least this many qualifying office days in the window. */
export const MIN_QUALIFYING_DAYS = 3;

/** Or at least this share of that weekday's calendar occurrences in the window. */
export const MIN_WEEKDAY_SHARE = 0.4;

/**
 * Do not infer or overwrite graceMinutes. Grace is how long to wait before an
 * absent alert, not a check-in time. Inferring it from scatter would either
 * nag early or hide real misses.
 */
export const AUTO_FILL_GRACE_MINUTES = false;

export type OfficeDaySample = {
  dayKey: string;
  firstInMinutes: number;
  lastOutMinutes: number | null;
};

export type InferredOfficeSchedule = {
  workDays: number[];
  officeStartTime: string;
  officeEndTime: string | null;
};

export type OfficeScheduleInferenceAnalysis = {
  inferred: InferredOfficeSchedule | null;
  officeDaysFound: number;
  qualifyingOfficeDays: number;
  weekdayCounts: Array<{
    weekday: number;
    officeDays: number;
    occurrences: number;
  }>;
};

export type AutoFillDecision = {
  scheduleUserSet: boolean;
  scheduleAutoFilled: boolean;
  workDays: number[];
  officeStartTime: string;
  officeEndTime: string;
};

export function addDaysToDayKey(dayKey: string, delta: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function isoWeekdayFromDayKey(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  const utcDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
}

export function eachDayKeyInclusive(startDayKey: string, endDayKey: string): string[] {
  const keys: string[] = [];
  let key = startDayKey;
  while (key <= endDayKey) {
    keys.push(key);
    key = addDaysToDayKey(key, 1);
  }
  return keys;
}

export function scheduleWindowForNow(todayKey: string): { startDayKey: string; endDayKey: string } {
  const endDayKey = addDaysToDayKey(todayKey, -1);
  const startDayKey = addDaysToDayKey(todayKey, -OFFICE_SCHEDULE_WINDOW_DAYS);
  return { startDayKey, endDayKey };
}

export function roundMinutesToNearest15(minutes: number): number {
  const rounded = Math.round(minutes / 15) * 15;
  return Math.min(24 * 60 - 15, Math.max(0, rounded));
}

export function minutesToHhMm(minutes: number): string {
  const clamped = roundMinutesToNearest15(minutes);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function weekdayOccurrenceCounts(startDayKey: string, endDayKey: string): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const key of eachDayKeyInclusive(startDayKey, endDayKey)) {
    counts[isoWeekdayFromDayKey(key)] += 1;
  }
  return counts;
}

function workDaysEqual(a: number[], b: number[]): boolean {
  const left = [...new Set(a)].sort((x, y) => x - y);
  const right = [...new Set(b)].sort((x, y) => x - y);
  return left.length === right.length && left.every((d, i) => d === right[i]);
}

export function isDefaultOfficeSchedule(prefs: {
  workDays: number[];
  officeStartTime: string;
  officeEndTime: string;
}): boolean {
  return (
    workDaysEqual(prefs.workDays, DEFAULT_WORK_DAYS) &&
    prefs.officeStartTime === DEFAULT_NOTIFICATION_PREFS.officeStartTime &&
    prefs.officeEndTime === DEFAULT_NOTIFICATION_PREFS.officeEndTime
  );
}

/**
 * Cron may fill defaults and refresh prior auto-fills. Skip explicit user/admin
 * saves. Skip legacy custom values that were never flagged (treat as user-owned).
 */
export function canApplyInferredSchedule(row: AutoFillDecision): boolean {
  if (row.scheduleUserSet) return false;
  if (row.scheduleAutoFilled) return true;
  return isDefaultOfficeSchedule(row);
}

export function inferredScheduleEqualsPrefs(
  inferred: InferredOfficeSchedule,
  prefs: { workDays: number[]; officeStartTime: string; officeEndTime: string },
): boolean {
  if (!workDaysEqual(inferred.workDays, prefs.workDays)) return false;
  if (inferred.officeStartTime !== prefs.officeStartTime) return false;
  if (inferred.officeEndTime == null) return true;
  return inferred.officeEndTime === prefs.officeEndTime;
}

export function inferOfficeSchedule(input: {
  samples: OfficeDaySample[];
  windowStartDayKey: string;
  windowEndDayKey: string;
}): InferredOfficeSchedule | null {
  return analyzeOfficeSchedule(input).inferred;
}

export function analyzeOfficeSchedule(input: {
  samples: OfficeDaySample[];
  windowStartDayKey: string;
  windowEndDayKey: string;
}): OfficeScheduleInferenceAnalysis {
  const occurrences = weekdayOccurrenceCounts(input.windowStartDayKey, input.windowEndDayKey);
  const byWeekday: OfficeDaySample[][] = [[], [], [], [], [], [], [], []];

  for (const sample of input.samples) {
    if (sample.dayKey < input.windowStartDayKey || sample.dayKey > input.windowEndDayKey) {
      continue;
    }
    const weekday = isoWeekdayFromDayKey(sample.dayKey);
    byWeekday[weekday].push(sample);
  }

  const workDays: number[] = [];
  for (let weekday = 1; weekday <= 7; weekday++) {
    const count = byWeekday[weekday].length;
    const denom = occurrences[weekday] || 0;
    const share = denom > 0 ? count / denom : 0;
    if (count >= MIN_QUALIFYING_DAYS || share >= MIN_WEEKDAY_SHARE) {
      workDays.push(weekday);
    }
  }

  const weekdayCounts = Array.from({ length: 7 }, (_, index) => ({
    weekday: index + 1,
    officeDays: byWeekday[index + 1].length,
    occurrences: occurrences[index + 1],
  }));

  if (workDays.length === 0) {
    return {
      inferred: null,
      officeDaysFound: input.samples.length,
      qualifyingOfficeDays: 0,
      weekdayCounts,
    };
  }

  const qualifying = workDays.flatMap((d) => byWeekday[d]);
  const startMedian = median(qualifying.map((s) => s.firstInMinutes));
  if (startMedian == null) {
    return {
      inferred: null,
      officeDaysFound: input.samples.length,
      qualifyingOfficeDays: 0,
      weekdayCounts,
    };
  }

  const ends = qualifying
    .map((s) => s.lastOutMinutes)
    .filter((m): m is number => m != null);
  const missingEnds = qualifying.length - ends.length;
  const manyOpen = qualifying.length > 0 && missingEnds / qualifying.length >= 0.5;
  const endMedian = manyOpen ? null : median(ends);

  return {
    inferred: {
      workDays,
      officeStartTime: minutesToHhMm(startMedian),
      officeEndTime: endMedian == null ? null : minutesToHhMm(endMedian),
    },
    officeDaysFound: input.samples.length,
    qualifyingOfficeDays: qualifying.length,
    weekdayCounts,
  };
}
