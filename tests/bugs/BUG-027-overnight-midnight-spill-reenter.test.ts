import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { dayBoundsFromKey } from "@/lib/timezone-dates";
import {
  daySpanHoursForDay,
  filterMidnightRolloverStubVisits,
  firstOfficeInMsForDay,
  type VisitForDaySpan,
} from "@/lib/visits";

const fixture = JSON.parse(
  readFileSync(
    path.join(
      process.cwd(),
      "tests/bugs/fixtures/overnight-midnight-spill-reenter.json",
    ),
    "utf8",
  ),
) as {
  timezone: string;
  dayKey: string;
  overnightSpill: { startAt: string; endAt: string };
  overnightSpillMidnight: { startAt: string; endAt: string };
  afternoonReenter: { startAt: string; endAt: string };
};

describe("BUG-027 overnight midnight spill must not own Today after re-enter", () => {
  const { start: dayStart, end: dayEnd } = dayBoundsFromKey(
    fixture.dayKey,
    fixture.timezone,
  );
  const reenterMs = new Date(fixture.afternoonReenter.startAt).getTime();

  const visits: VisitForDaySpan[] = [
    {
      id: "spill-midnight",
      startAt: new Date(fixture.overnightSpillMidnight.startAt),
      endAt: new Date(fixture.overnightSpillMidnight.endAt),
      source: "wifi",
      updatedAt: new Date(fixture.overnightSpillMidnight.endAt),
    },
    {
      id: "spill-0018",
      startAt: new Date(fixture.overnightSpill.startAt),
      endAt: new Date(fixture.overnightSpill.endAt),
      source: "wifi",
      updatedAt: new Date(fixture.overnightSpill.endAt),
    },
    {
      id: "afternoon",
      startAt: new Date(fixture.afternoonReenter.startAt),
      endAt: new Date(fixture.afternoonReenter.endAt),
      source: "wifi",
      updatedAt: new Date(fixture.afternoonReenter.endAt),
    },
  ];

  it("drops overnight visits that only spill past midnight when a later re-enter exists", () => {
    const kept = filterMidnightRolloverStubVisits(visits, dayStart);
    expect(kept.map((v) => v.id)).toEqual(["afternoon"]);
  });

  it("sets first check-in and day span from the afternoon enter, not 12:00 am", () => {
    const params = {
      dayStart,
      dayEnd,
      now: new Date("2026-10-16T16:00:00+05:30"),
      staleMs: 15 * 60 * 1000,
      lastHeartbeatAt: new Date(fixture.afternoonReenter.endAt),
      firstInOfficeHeartbeatAt: new Date("2026-10-16T00:00:30+05:30"),
      lastInOfficeHeartbeatAt: new Date(fixture.afternoonReenter.endAt),
    };
    expect(firstOfficeInMsForDay(visits, params)).toBe(reenterMs);
    // Must not bridge midnight spill through the sleep gap (~15h).
    expect(daySpanHoursForDay(visits, params)).toBeLessThan(1);
    expect(daySpanHoursForDay(visits, params)).toBeGreaterThan(0);
  });
});
