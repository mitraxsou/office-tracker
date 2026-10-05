import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { daySpanMsForDay } from "@/lib/visits";
import { dayBoundsFromKey } from "@/lib/timezone-dates";

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/bugs/fixtures/day-total-in-office-segments.json"),
    "utf8",
  ),
) as {
  dayKey: string;
  timezone: string;
  strayEarlyPulseAt: string;
  lastOfficeAt: string;
  now: string;
  visits: Array<{ id: string; startAt: string; endAt: string }>;
};

describe("BUG-012 day total is time spent in office, not first pulse to last checkout", () => {
  it("merges overlapping afternoon visits and ignores a leftover overnight pulse", () => {
    const { start: dayStart, end: dayEnd } = dayBoundsFromKey(
      fixture.dayKey,
      fixture.timezone,
    );
    const firstVisit = new Date(fixture.visits[0].startAt);
    const lastVisitEnd = new Date(fixture.lastOfficeAt);
    const spanMs = daySpanMsForDay(
      fixture.visits.map((visit) => ({
        id: visit.id,
        startAt: new Date(visit.startAt),
        endAt: new Date(visit.endAt),
        source: "wifi",
        updatedAt: new Date(visit.endAt),
      })),
      {
        dayStart,
        dayEnd,
        now: new Date(fixture.now),
        staleMs: 15 * 60 * 1000,
        lastHeartbeatAt: lastVisitEnd,
        firstInOfficeHeartbeatAt: new Date(fixture.strayEarlyPulseAt),
        lastInOfficeHeartbeatAt: lastVisitEnd,
      },
    );

    expect(spanMs).toBe(lastVisitEnd.getTime() - firstVisit.getTime());
    expect(spanMs).toBeLessThan(10 * 60 * 60 * 1000);
    expect(spanMs).toBeLessThan(
      lastVisitEnd.getTime() - new Date(fixture.strayEarlyPulseAt).getTime(),
    );
  });
});
