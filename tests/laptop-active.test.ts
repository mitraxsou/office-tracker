import { describe, expect, it } from "vitest";
import { VISIT_GAP_MS } from "../src/lib/constants";
import {
  laptopActiveHoursForDay,
  laptopActiveMsForDay,
  type LaptopActiveParams,
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
    firstHeartbeatAt: null,
    lastHeartbeatAt: null,
    lastHeartbeatOverall: null,
    ...overrides,
  };
}

describe("laptopActiveMsForDay", () => {
  it("returns 0 when there are no heartbeats", () => {
    expect(laptopActiveMsForDay(baseParams())).toBe(0);
  });

  it("returns span from first to last pulse on a past day", () => {
    const first = new Date("2026-09-01T09:00:00.000+05:30");
    const last = new Date("2026-09-01T18:00:00.000+05:30");
    const { dayStart, dayEnd } = dayBounds("2026-09-01");
    const ms = laptopActiveMsForDay({
      dayStart,
      dayEnd,
      now: new Date("2026-09-02T10:00:00.000+05:30"),
      staleMs,
      firstHeartbeatAt: first,
      lastHeartbeatAt: last,
      lastHeartbeatOverall: last,
    });
    expect(ms).toBe(9 * 60 * 60 * 1000);
    expect(laptopActiveHoursForDay({
      dayStart,
      dayEnd,
      now: new Date("2026-09-02T10:00:00.000+05:30"),
      staleMs,
      firstHeartbeatAt: first,
      lastHeartbeatAt: last,
      lastHeartbeatOverall: last,
    })).toBe(9);
  });

  it("extends to now on the current day when agent is still pulsing", () => {
    const first = new Date("2026-09-02T09:00:00.000+05:30");
    const last = new Date("2026-09-02T14:58:00.000+05:30");
    const now = new Date("2026-09-02T15:00:00.000+05:30");
    const ms = laptopActiveMsForDay({
      ...baseParams(),
      firstHeartbeatAt: first,
      lastHeartbeatAt: last,
      lastHeartbeatOverall: last,
      now,
    });
    expect(ms).toBe(6 * 60 * 60 * 1000);
  });

  it("does not extend to now when agent is stale on the current day", () => {
    const first = new Date("2026-09-02T09:00:00.000+05:30");
    const last = new Date("2026-09-02T12:00:00.000+05:30");
    const now = new Date("2026-09-02T18:00:00.000+05:30");
    const ms = laptopActiveMsForDay({
      ...baseParams(),
      firstHeartbeatAt: first,
      lastHeartbeatAt: last,
      lastHeartbeatOverall: last,
      now,
    });
    expect(ms).toBe(3 * 60 * 60 * 1000);
  });

  it("counts all pulses regardless of office Wi-Fi", () => {
    const first = new Date("2026-09-02T08:00:00.000+05:30");
    const last = new Date("2026-09-02T17:30:00.000+05:30");
    const ms = laptopActiveMsForDay({
      ...baseParams(),
      firstHeartbeatAt: first,
      lastHeartbeatAt: last,
      lastHeartbeatOverall: last,
      now: new Date("2026-09-02T17:30:00.000+05:30"),
    });
    expect(ms).toBe(9.5 * 60 * 60 * 1000);
  });

  it("caps span at 24 hours", () => {
    const first = new Date("2026-09-02T00:00:00.000+05:30");
    const last = new Date("2026-09-02T23:59:00.000+05:30");
    const ms = laptopActiveMsForDay({
      ...baseParams(),
      firstHeartbeatAt: first,
      lastHeartbeatAt: last,
      lastHeartbeatOverall: last,
      now: new Date("2026-09-02T23:59:59.999+05:30"),
    });
    expect(ms).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    expect(ms).toBeGreaterThan(23 * 60 * 60 * 1000);
  });

  it("extends from a single pulse when agent is still running", () => {
    const pulse = new Date("2026-09-02T09:00:00.000+05:30");
    const now = new Date("2026-09-02T11:00:00.000+05:30");
    const recentPulse = new Date("2026-09-02T10:58:00.000+05:30");
    const ms = laptopActiveMsForDay({
      ...baseParams(),
      firstHeartbeatAt: pulse,
      lastHeartbeatAt: pulse,
      lastHeartbeatOverall: recentPulse,
      now,
    });
    expect(ms).toBe(2 * 60 * 60 * 1000);
  });
});
