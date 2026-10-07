import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { daySpanMsForDay } from "@/lib/visits";
import { dayBoundsFromKey } from "@/lib/timezone-dates";
import { userAttendedOnDay } from "@/lib/admin-day-compliance";

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/bugs/fixtures/pulse-only-no-visit-hours.json"),
    "utf8",
  ),
) as {
  dayKey: string;
  timezone: string;
  firstPulseAt: string;
  lastPulseAt: string;
  now: string;
  visits: Array<{ id: string; startAt: string; endAt: string | null }>;
};

describe("BUG-016 pulses alone do not invent Visit-backed office hours", () => {
  it("returns zero day span when there are no Visit rows", () => {
    const { start: dayStart, end: dayEnd } = dayBoundsFromKey(
      fixture.dayKey,
      fixture.timezone,
    );
    const spanMs = daySpanMsForDay([], {
      dayStart,
      dayEnd,
      now: new Date(fixture.now),
      staleMs: 15 * 60 * 1000,
      lastHeartbeatAt: new Date(fixture.lastPulseAt),
      firstInOfficeHeartbeatAt: new Date(fixture.firstPulseAt),
      lastInOfficeHeartbeatAt: new Date(fixture.lastPulseAt),
    });
    expect(spanMs).toBe(0);
  });

  it("does not mark attendance from pulses without a Visit", () => {
    const { start: dayStart, end: dayEnd } = dayBoundsFromKey(
      fixture.dayKey,
      fixture.timezone,
    );
    expect(
      userAttendedOnDay({
        visits: [],
        dayStart,
        dayEnd,
        inOfficeHeartbeats: [
          new Date(fixture.firstPulseAt),
          new Date(fixture.lastPulseAt),
        ],
        totalMs: 0,
        now: new Date(fixture.now),
      }),
    ).toBe(false);
  });
});
