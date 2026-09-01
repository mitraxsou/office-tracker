/**
 * Day boundaries in a user's IANA timezone (e.g. Asia/Kolkata).
 * Avoids `new Date("YYYY-MM-DDT00:00:00")` which is UTC on Vercel, not local midnight.
 */

function parseDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return { year, month, day };
}

function wallClockToUtc(
  dayKey: string,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone: string,
): Date {
  const { year, month, day } = parseDayKey(dayKey);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const readWall = (ts: number) => {
    const parts = formatter.formatToParts(new Date(ts));
    const pick = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value ?? 0);
    return {
      year: pick("year"),
      month: pick("month"),
      day: pick("day"),
      hour: pick("hour") % 24,
      minute: pick("minute"),
      second: pick("second"),
    };
  };

  const desired = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  let ts = desired;
  for (let i = 0; i < 4; i++) {
    const wall = readWall(ts);
    const actual = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second, 0);
    ts += desired - actual;
  }
  return new Date(ts);
}

export function dayKeyInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getDayBounds(date: Date, timezone: string) {
  const dayKey = dayKeyInTimezone(date, timezone);
  const start = wallClockToUtc(dayKey, 0, 0, 0, 0, timezone);
  const end = wallClockToUtc(dayKey, 23, 59, 59, 999, timezone);
  return { dayKey, start, end };
}

export function dayBoundsFromKey(dayKey: string, timezone: string) {
  const start = wallClockToUtc(dayKey, 0, 0, 0, 0, timezone);
  const end = wallClockToUtc(dayKey, 23, 59, 59, 999, timezone);
  return { dayKey, start, end };
}
