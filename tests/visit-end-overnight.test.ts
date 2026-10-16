import { describe, expect, it } from "vitest";
import { dayBoundsFromKey } from "../src/lib/timezone-dates";
import {
  daySpanHoursForDay,
  firstOfficeInMsForDay,
  type VisitForDaySpan,
} from "../src/lib/visits";
import {
  canAgentRefineVisitEnd,
  canUserSelfCorrectVisitEnd,
  inferredCheckoutNotice,
} from "../src/lib/visit-end";

const TZ = "Asia/Kolkata";
const STALE_MS = 15 * 60 * 1000;

describe("overnight visit first check-in (no midnight invent)", () => {
  it("does not show 12:00 am when yesterday open visit has no office pulse today", () => {
    const now = new Date("2026-10-15T13:52:00+05:30");
    const { start: dayStart, end: dayEnd } = dayBoundsFromKey("2026-10-15", TZ);
    const visits: VisitForDaySpan[] = [
      {
        id: "v1",
        startAt: new Date("2026-10-14T12:00:00+05:30"),
        endAt: null,
        source: "wifi",
        updatedAt: new Date("2026-10-14T18:00:00+05:30"),
      },
    ];
    const params = {
      dayStart,
      dayEnd,
      now,
      staleMs: STALE_MS,
      lastHeartbeatAt: new Date("2026-10-14T18:00:00+05:30"),
      firstInOfficeHeartbeatAt: null,
      lastInOfficeHeartbeatAt: null,
    };
    expect(firstOfficeInMsForDay(visits, params)).toBeNull();
    expect(daySpanHoursForDay(visits, params)).toBe(0);
  });

  it("uses today's first office pulse when overnight visit continues with presence", () => {
    const now = new Date("2026-10-15T10:00:00+05:30");
    const { start: dayStart, end: dayEnd } = dayBoundsFromKey("2026-10-15", TZ);
    const firstPulse = new Date("2026-10-15T09:05:00+05:30");
    const visits: VisitForDaySpan[] = [
      {
        id: "v1",
        startAt: new Date("2026-10-14T18:00:00+05:30"),
        endAt: null,
        source: "wifi",
        updatedAt: new Date("2026-10-15T09:05:00+05:30"),
      },
    ];
    const params = {
      dayStart,
      dayEnd,
      now,
      staleMs: STALE_MS,
      lastHeartbeatAt: firstPulse,
      firstInOfficeHeartbeatAt: firstPulse,
      lastInOfficeHeartbeatAt: firstPulse,
    };
    expect(firstOfficeInMsForDay(visits, params)).toBe(firstPulse.getTime());
    expect(daySpanHoursForDay(visits, params)).toBeGreaterThan(0);
  });

  it("starts Today at afternoon re-enter, not midnight NEW_DAY stub before sleep", () => {
    const now = new Date("2026-10-16T15:33:00+05:30");
    const { start: dayStart, end: dayEnd } = dayBoundsFromKey("2026-10-16", TZ);
    const reenter = new Date("2026-10-16T14:55:06+05:30");
    const visits: VisitForDaySpan[] = [
      {
        id: "midnight-stub",
        startAt: new Date("2026-10-16T00:00:00+05:30"),
        endAt: new Date("2026-10-16T00:18:06+05:30"),
        source: "wifi",
        updatedAt: new Date("2026-10-16T00:18:06+05:30"),
      },
      {
        id: "afternoon",
        startAt: reenter,
        endAt: new Date("2026-10-16T14:58:51+05:30"),
        source: "wifi",
        updatedAt: new Date("2026-10-16T14:58:51+05:30"),
      },
    ];
    const params = {
      dayStart,
      dayEnd,
      now,
      staleMs: STALE_MS,
      lastHeartbeatAt: reenter,
      firstInOfficeHeartbeatAt: new Date("2026-10-16T00:00:30+05:30"),
      lastInOfficeHeartbeatAt: reenter,
    };
    expect(firstOfficeInMsForDay(visits, params)).toBe(reenter.getTime());
    // Must not bridge midnight stub through the sleep gap (~15h).
    expect(daySpanHoursForDay(visits, params)).toBeLessThan(1);
    expect(daySpanHoursForDay(visits, params)).toBeGreaterThan(0);
  });

  it("starts Today at afternoon re-enter, not overnight spill ending at midnight", () => {
    const now = new Date("2026-10-16T16:00:00+05:30");
    const { start: dayStart, end: dayEnd } = dayBoundsFromKey("2026-10-16", TZ);
    const reenter = new Date("2026-10-16T14:55:00+05:30");
    const visits: VisitForDaySpan[] = [
      {
        id: "overnight-eod",
        startAt: new Date("2026-10-15T14:37:00+05:30"),
        endAt: new Date("2026-10-16T00:00:00+05:30"),
        source: "wifi",
        updatedAt: new Date("2026-10-16T00:00:00+05:30"),
      },
      {
        id: "overnight-spill",
        startAt: new Date("2026-10-15T14:37:00+05:30"),
        endAt: new Date("2026-10-16T00:18:00+05:30"),
        source: "wifi",
        updatedAt: new Date("2026-10-16T00:18:00+05:30"),
      },
      {
        id: "afternoon",
        startAt: reenter,
        endAt: new Date("2026-10-16T14:58:00+05:30"),
        source: "wifi",
        updatedAt: new Date("2026-10-16T14:58:00+05:30"),
      },
    ];
    const params = {
      dayStart,
      dayEnd,
      now,
      staleMs: STALE_MS,
      lastHeartbeatAt: reenter,
      firstInOfficeHeartbeatAt: new Date("2026-10-16T00:00:30+05:30"),
      lastInOfficeHeartbeatAt: reenter,
    };
    expect(firstOfficeInMsForDay(visits, params)).toBe(reenter.getTime());
    expect(daySpanHoursForDay(visits, params)).toBeLessThan(1);
    expect(daySpanHoursForDay(visits, params)).toBeGreaterThan(0);
  });
});

describe("visit end provenance", () => {
  it("allows agent and user to refine inferred or legacy ends", () => {
    expect(canAgentRefineVisitEnd("inferred")).toBe(true);
    expect(canAgentRefineVisitEnd(null)).toBe(true);
    expect(canAgentRefineVisitEnd("agent")).toBe(false);
    expect(canAgentRefineVisitEnd("manual")).toBe(false);
    expect(canUserSelfCorrectVisitEnd("inferred")).toBe(true);
    expect(canUserSelfCorrectVisitEnd("admin")).toBe(false);
    expect(inferredCheckoutNotice("inferred")).toMatch(/estimated/i);
    expect(inferredCheckoutNotice("agent")).toBeNull();
  });
});
