import { describe, expect, it } from "vitest";
import { buildPulseTimeline24h } from "../src/lib/heartbeat-service";

describe("buildPulseTimeline24h", () => {
  it("buckets heartbeats into hourly slots over the last 24 hours", () => {
    const now = new Date("2026-09-02T12:00:00Z");
    const recent = new Date("2026-09-02T11:30:00Z");
    const older = new Date("2026-09-01T13:00:00Z");
    const stale = new Date("2026-08-31T12:00:00Z");

    const buckets = buildPulseTimeline24h([recent, older, stale], now, 24);
    expect(buckets.reduce((sum, n) => sum + n, 0)).toBe(2);
    expect(buckets.some((n) => n > 0)).toBe(true);
  });
});
