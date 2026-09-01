import { describe, expect, it } from "vitest";
import { getDayBounds } from "../src/lib/timezone-dates";
import { effectiveVisitEnd } from "../src/lib/visits";
import { VISIT_GAP_MS } from "../src/lib/constants";

describe("timezone day bounds (Asia/Kolkata)", () => {
  it("uses local midnight not UTC for day start", () => {
    const earlyMorning = new Date("2026-09-02T01:38:00+05:30");
    const { dayKey, start, end } = getDayBounds(earlyMorning, "Asia/Kolkata");
    expect(dayKey).toBe("2026-09-02");
    expect(earlyMorning.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(earlyMorning.getTime()).toBeLessThanOrEqual(end.getTime());
  });

  it("counts hours after midnight for an open overnight visit", () => {
    const now = new Date("2026-09-02T01:38:00+05:30");
    const { start: dayStart, end: dayEnd } = getDayBounds(now, "Asia/Kolkata");
    const visitStart = new Date("2026-09-01T21:17:00+05:30");
    const clippedStart = visitStart < dayStart ? dayStart : visitStart;
    const end = effectiveVisitEnd({
      endAt: null,
      updatedAt: visitStart,
      startAt: visitStart,
      now,
      staleMs: VISIT_GAP_MS,
      lastHeartbeatAt: now,
      dayEnd,
    });
    const clippedEnd = end > dayEnd ? dayEnd : end;
    const hours = (clippedEnd.getTime() - clippedStart.getTime()) / (1000 * 60 * 60);
    expect(hours).toBeGreaterThan(1);
    expect(hours).toBeLessThan(2);
  });
});
