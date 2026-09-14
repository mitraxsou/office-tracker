import { describe, expect, it } from "vitest";
import { VISIT_GAP_MS } from "../src/lib/constants";
import {
  agentUptimeMsFromSignals,
  laptopActiveHoursForDay,
  resolveLaptopActiveForDay,
  type LaptopActiveParams,
  type UptimeSignal,
} from "../src/lib/laptop-active";

const staleMs = VISIT_GAP_MS;
const tz = "+05:30";

function dayBounds(day: string) {
  return {
    dayStart: new Date(`${day}T00:00:00.000${tz}`),
    dayEnd: new Date(`${day}T23:59:59.999${tz}`),
  };
}

function baseParams(overrides: Partial<LaptopActiveParams> = {}): LaptopActiveParams {
  const { dayStart, dayEnd } = dayBounds("2026-09-02");
  return {
    dayStart,
    dayEnd,
    now: new Date("2026-09-02T15:00:00.000+05:30"),
    staleMs,
    agentLaptopActiveMs: null,
    agentFirstAgentOnAt: null,
    uptimeSignals: [],
    lastSignalOverall: null,
    ...overrides,
  };
}

describe("agentUptimeMsFromSignals", () => {
  it("returns 0 when there are no signals", () => {
    const { dayStart, dayEnd } = dayBounds("2026-09-02");
    expect(
      agentUptimeMsFromSignals([], {
        dayStart,
        dayEnd,
        now: new Date("2026-09-02T12:00:00.000+05:30"),
        staleMs,
        isCurrentDay: true,
        lastSignalOverall: null,
      }),
    ).toBe(0);
  });

  it("sums one continuous session from ticks and extends to now", () => {
    const signals: UptimeSignal[] = [
      { at: new Date("2026-09-02T09:00:00.000+05:30"), kind: "tick" },
      { at: new Date("2026-09-02T09:05:00.000+05:30"), kind: "tick" },
      { at: new Date("2026-09-02T09:10:00.000+05:30"), kind: "tick" },
    ];
    const { dayStart, dayEnd } = dayBounds("2026-09-02");
    const ms = agentUptimeMsFromSignals(signals, {
      dayStart,
      dayEnd,
      now: new Date("2026-09-02T15:00:00.000+05:30"),
      staleMs,
      isCurrentDay: true,
      lastSignalOverall: signals[2].at,
    });
    expect(ms).toBe(6 * 60 * 60 * 1000);
  });

  it("ends a session when tick gap exceeds stale window", () => {
    const signals: UptimeSignal[] = [
      { at: new Date("2026-09-02T09:00:00.000+05:30"), kind: "tick" },
      { at: new Date("2026-09-02T10:00:00.000+05:30"), kind: "tick" },
      { at: new Date("2026-09-02T14:30:00.000+05:30"), kind: "tick" },
      { at: new Date("2026-09-02T16:00:00.000+05:30"), kind: "tick" },
    ];
    const { dayStart, dayEnd } = dayBounds("2026-09-02");
    const ms = agentUptimeMsFromSignals(signals, {
      dayStart,
      dayEnd,
      now: new Date("2026-09-02T16:00:00.000+05:30"),
      staleMs,
      isCurrentDay: true,
      lastSignalOverall: signals[3].at,
    });
    expect(ms).toBe(2.5 * 60 * 60 * 1000);
  });

  it("does not extend to now on a past day", () => {
    const signals: UptimeSignal[] = [
      { at: new Date("2026-09-01T09:00:00.000+05:30"), kind: "tick" },
      { at: new Date("2026-09-01T09:05:00.000+05:30"), kind: "tick" },
      { at: new Date("2026-09-01T09:10:00.000+05:30"), kind: "tick" },
    ];
    const { dayStart, dayEnd } = dayBounds("2026-09-01");
    const ms = agentUptimeMsFromSignals(signals, {
      dayStart,
      dayEnd,
      now: new Date("2026-09-02T10:00:00.000+05:30"),
      staleMs,
      isCurrentDay: false,
      lastSignalOverall: signals[2].at,
    });
    expect(ms).toBe(10 * 60 * 1000);
  });
});

describe("resolveLaptopActiveForDay", () => {
  it("prefers agent-reported ms and extends on the current day", () => {
    const last = new Date("2026-09-02T14:58:00.000+05:30");
    const now = new Date("2026-09-02T15:00:00.000+05:30");
    const firstOn = new Date("2026-09-02T09:00:00.000+05:30");
    const result = resolveLaptopActiveForDay(
      baseParams({
        agentLaptopActiveMs: 5 * 60 * 60 * 1000,
        agentFirstAgentOnAt: firstOn,
        lastSignalOverall: last,
        now,
      }),
    );
    expect(result.ms).toBe(5 * 60 * 60 * 1000 + 2 * 60 * 1000);
    expect(result.firstAgentOnAt).toEqual(firstOn);
  });

  it("falls back to session signals when agent ms is missing", () => {
    const signals: UptimeSignal[] = [
      { at: new Date("2026-09-02T09:00:00.000+05:30"), kind: "tick" },
      { at: new Date("2026-09-02T09:05:00.000+05:30"), kind: "tick" },
      { at: new Date("2026-09-02T09:10:00.000+05:30"), kind: "tick" },
    ];
    const hours = laptopActiveHoursForDay(
      baseParams({
        uptimeSignals: signals,
        lastSignalOverall: signals[2].at,
        now: new Date("2026-09-02T11:00:00.000+05:30"),
      }),
    );
    expect(hours).toBe(2);
  });
});
