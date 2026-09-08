import { describe, expect, it } from "vitest";
import { getDayBounds, isFutureDayKey, isCurrentCalendarDay } from "../src/lib/timezone-dates";
import { dayKeyInTimezone, effectiveVisitEnd } from "../src/lib/visits";
import { VISIT_GAP_MS } from "../src/lib/constants";

describe("visit date labels (Asia/Kolkata)", () => {
  it("labels an after-midnight visit with the local day, not the UTC day", () => {
    // 12:45 am IST on 3 Sept is still 2 Sept in UTC. Slicing the ISO string showed 09-02.
    const startAt = new Date("2026-09-03T00:45:00+05:30");
    expect(startAt.toISOString().slice(0, 10)).toBe("2026-09-02");
    expect(dayKeyInTimezone(startAt, "Asia/Kolkata")).toBe("2026-09-03");
  });

  it("keeps daytime visits on the same day", () => {
    const startAt = new Date("2026-09-02T11:46:00+05:30");
    expect(dayKeyInTimezone(startAt, "Asia/Kolkata")).toBe("2026-09-02");
  });
});

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

describe("isCurrentCalendarDay and isFutureDayKey", () => {
  it("detects current calendar day in timezone", () => {
    const now = new Date("2026-09-08T12:00:00+05:30");
    const { start, end } = getDayBounds(now, "Asia/Kolkata");
    expect(isCurrentCalendarDay(start, end, now)).toBe(true);
    expect(isFutureDayKey("2026-09-12", "Asia/Kolkata", now)).toBe(true);
    expect(isFutureDayKey("2026-09-08", "Asia/Kolkata", now)).toBe(false);
    expect(isFutureDayKey("2026-09-07", "Asia/Kolkata", now)).toBe(false);
  });
});
