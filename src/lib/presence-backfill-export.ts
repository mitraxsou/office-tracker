import { prisma } from "./db";
import { closeEndOfDayOpenVisits, loadDaySpanContext } from "./heartbeat-service";
import { dayKeyInTimezone } from "./timezone-dates";
import { daySpanMsForDay, firstOfficeInMsForDay } from "./visits";

/**
 * One row per user per calendar day that has any office time (any visit, however short).
 * Users with no office days still get one row with empty day fields so the importer can
 * create them. Hours are informational only; there is no daily target gate.
 */
export const PRESENCE_BACKFILL_HEADERS = [
  "email",
  "name",
  "preferredName",
  "timezone",
  "role",
  "dayKey",
  "firstIn",
  "lastOut",
  "hours",
] as const;

export type PresenceBackfillRow = {
  email: string;
  name: string;
  preferredName: string;
  timezone: string;
  role: string;
  dayKey: string;
  firstIn: string;
  lastOut: string;
  hours: string;
};

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildPresenceBackfillCsv(rows: PresenceBackfillRow[]): string {
  const lines = [PRESENCE_BACKFILL_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.email,
        row.name,
        row.preferredName,
        row.timezone,
        row.role,
        row.dayKey,
        row.firstIn,
        row.lastOut,
        row.hours,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/**
 * Build backfill rows for every user, through yesterday in each user's timezone.
 * Day math reuses the same span helpers as Today and admin compliance, so a day's
 * first in and last out match what Office Tracker shows for that day.
 * Side effect: closes visits left open after their day ended (same as admin compliance pages).
 */
export async function buildPresenceBackfillRows(now = new Date()): Promise<PresenceBackfillRow[]> {
  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      preferredName: true,
      timezone: true,
      role: true,
      visits: { select: { startAt: true, endAt: true } },
    },
  });

  const rows: PresenceBackfillRow[] = [];
  for (const user of users) {
    const timezone = user.timezone || "Asia/Kolkata";
    const todayKey = dayKeyInTimezone(now, timezone);

    // Same maintenance that admin compliance runs before reading days.
    await closeEndOfDayOpenVisits(user.id, timezone);

    const candidateDays = new Set<string>();
    for (const visit of user.visits) {
      candidateDays.add(dayKeyInTimezone(visit.startAt, timezone));
      if (visit.endAt) candidateDays.add(dayKeyInTimezone(visit.endAt, timezone));
    }

    const days = [...candidateDays]
      .filter((dayKey) => dayKey < todayKey)
      .sort();

    const base = {
      email: user.email,
      name: user.name ?? "",
      preferredName: user.preferredName ?? "",
      timezone,
      role: user.role,
    };

    let wroteDay = false;
    for (const dayKey of days) {
      const { visits, params } = await loadDaySpanContext(user.id, dayKey, timezone, {
        skipMaintenance: true,
      });
      const spanMs = daySpanMsForDay(visits, params);
      if (spanMs <= 0) continue;

      const firstIn = firstOfficeInMsForDay(visits, params);
      if (firstIn === null) continue;
      const lastOut = firstIn + spanMs;

      rows.push({
        ...base,
        dayKey,
        firstIn: new Date(firstIn).toISOString(),
        lastOut: new Date(lastOut).toISOString(),
        hours: (spanMs / (1000 * 60 * 60)).toFixed(2),
      });
      wroteDay = true;
    }

    if (!wroteDay) {
      rows.push({ ...base, dayKey: "", firstIn: "", lastOut: "", hours: "" });
    }
  }

  return rows;
}
