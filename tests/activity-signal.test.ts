import { describe, expect, it } from "vitest";
import {
  agentModeUsesActivityTicks,
  deviceRegistrationReferenceAt,
  expectedTicksPerDay,
  isLowActivityCount,
  latestDeviceLastSeenAt,
  lastAgentSignalAtOrBefore,
  lowActivityThreshold,
  minutesSinceAt,
  resolveAgentSyncHealth,
  resolveInOfficeNow,
  shouldUseActivityTicks,
} from "../src/lib/activity-signal";

describe("expectedTicksPerDay", () => {
  it("derives daily tick count from heartbeat interval minutes", () => {
    expect(expectedTicksPerDay(5)).toBe(288);
    expect(expectedTicksPerDay(10)).toBe(144);
    expect(expectedTicksPerDay(2)).toBe(720);
  });
});

describe("agentModeUsesActivityTicks", () => {
  it("defaults to activity ticks for events mode", () => {
    expect(agentModeUsesActivityTicks("events")).toBe(true);
    expect(agentModeUsesActivityTicks(undefined)).toBe(true);
  });

  it("uses heartbeats only when admin set legacy heartbeat mode", () => {
    expect(agentModeUsesActivityTicks("heartbeat")).toBe(false);
  });
});

describe("lastAgentSignalAtOrBefore", () => {
  it("returns the latest pulse at or before the cutoff", () => {
    const rows = [
      { at: new Date("2026-09-04T09:00:00Z") },
      { at: new Date("2026-09-04T12:00:00Z") },
      { at: new Date("2026-09-04T15:00:00Z") },
    ];
    expect(lastAgentSignalAtOrBefore(rows, new Date("2026-09-04T13:00:00Z"))).toEqual(
      new Date("2026-09-04T12:00:00Z"),
    );
  });
});

describe("shouldUseActivityTicks", () => {
  it("prefers activity ticks when present in the last 24h", () => {
    expect(shouldUseActivityTicks(3, false, true)).toBe(true);
  });

  it("falls back to heartbeats when no activity ticks exist", () => {
    expect(shouldUseActivityTicks(0, false, true)).toBe(false);
  });

  it("uses activity when only activity ticks exist", () => {
    expect(shouldUseActivityTicks(0, true, false)).toBe(true);
  });
});

describe("resolveInOfficeNow", () => {
  it("treats an open visit as authoritative", () => {
    expect(
      resolveInOfficeNow({
        hasOpenVisit: true,
        pulseRecent: false,
        lastPulseInOffice: false,
      }),
    ).toBe(true);
  });

  it("uses recent in-office pulse when no visit is open", () => {
    expect(
      resolveInOfficeNow({
        hasOpenVisit: false,
        pulseRecent: true,
        lastPulseInOffice: true,
      }),
    ).toBe(true);
    expect(
      resolveInOfficeNow({
        hasOpenVisit: false,
        pulseRecent: true,
        lastPulseInOffice: false,
      }),
    ).toBe(false);
  });
});

describe("sync freshness helpers", () => {
  it("picks the latest device lastSeenAt", () => {
    const older = new Date("2026-09-12T10:00:00Z");
    const newer = new Date("2026-09-13T10:00:00Z");
    expect(
      latestDeviceLastSeenAt([
        { createdAt: older, lastSeenAt: older, installedAt: older },
        { createdAt: older, lastSeenAt: newer, installedAt: older },
      ]),
    ).toEqual(newer);
  });

  it("computes minutes since a timestamp", () => {
    const now = new Date("2026-09-13T12:00:00Z");
    const at = new Date("2026-09-13T11:30:00Z");
    expect(minutesSinceAt(at, now)).toBe(30);
    expect(minutesSinceAt(null, now)).toBeNull();
  });
});

describe("resolveAgentSyncHealth", () => {
  const now = new Date("2026-09-13T12:00:00Z");
  const registeredAt = new Date("2026-09-01T12:00:00Z");
  const expectedPerDay = 288;

  it("treats recent pulse activity as healthy even when lastSeenAt is older", () => {
    const lastSyncedAt = new Date("2026-09-13T11:48:00Z");
    const health = resolveAgentSyncHealth(
      {
        lastSyncedAt,
        graceHours: 24,
        pulseAgentHealthy: true,
        pulsesLast24h: 40,
        expectedPulsesPerDay: expectedPerDay,
        deviceReferenceAt: registeredAt,
      },
      now,
    );
    expect(health.healthy).toBe(true);
    expect(health.showStaleWarning).toBe(false);
    expect(health.minutesSinceLastSync).toBe(12);
  });

  it("does not warn when lastSeenAt is within grace even if pulse is stale", () => {
    const lastSyncedAt = new Date("2026-09-13T11:48:00Z");
    const health = resolveAgentSyncHealth(
      {
        lastSyncedAt,
        graceHours: 24,
        pulseAgentHealthy: false,
        pulsesLast24h: 40,
        expectedPulsesPerDay: expectedPerDay,
        deviceReferenceAt: registeredAt,
      },
      now,
    );
    expect(health.healthy).toBe(true);
    expect(health.showStaleWarning).toBe(false);
  });

  it("does not warn when tick volume in 24h meets the expected threshold", () => {
    const lastSyncedAt = new Date("2026-09-12T10:00:00Z");
    const health = resolveAgentSyncHealth(
      {
        lastSyncedAt,
        graceHours: 24,
        pulseAgentHealthy: false,
        pulsesLast24h: 40,
        expectedPulsesPerDay: expectedPerDay,
        deviceReferenceAt: registeredAt,
      },
      now,
    );
    expect(health.healthy).toBe(true);
    expect(health.showStaleWarning).toBe(false);
  });

  it("warns only when beyond grace, pulse stale, and low tick volume", () => {
    const lastSyncedAt = new Date("2026-09-12T10:00:00Z");
    const health = resolveAgentSyncHealth(
      {
        lastSyncedAt,
        graceHours: 24,
        pulseAgentHealthy: false,
        pulsesLast24h: 5,
        expectedPulsesPerDay: expectedPerDay,
        deviceReferenceAt: registeredAt,
      },
      now,
    );
    expect(health.healthy).toBe(false);
    expect(health.showStaleWarning).toBe(true);
    expect(health.lowActivity).toBe(true);
  });

  it("distinguishes last synced from low office activity on home Wi-Fi", () => {
    const lastSyncedAt = new Date("2026-09-13T11:55:00Z");
    const health = resolveAgentSyncHealth(
      {
        lastSyncedAt,
        graceHours: 24,
        pulseAgentHealthy: true,
        pulsesLast24h: 200,
        expectedPulsesPerDay: expectedPerDay,
        deviceReferenceAt: registeredAt,
      },
      now,
    );
    expect(health.healthy).toBe(true);
    expect(health.showStaleWarning).toBe(false);
    expect(health.minutesSinceLastSync).toBe(5);
  });

  it("warns when last synced is stale and office activity ticks are low", () => {
    const lastSyncedAt = new Date("2026-09-11T10:00:00Z");
    const health = resolveAgentSyncHealth(
      {
        lastSyncedAt,
        graceHours: 24,
        pulseAgentHealthy: false,
        pulsesLast24h: 3,
        expectedPulsesPerDay: expectedPerDay,
        deviceReferenceAt: registeredAt,
      },
      now,
    );
    expect(health.showStaleWarning).toBe(true);
    expect(health.lowActivity).toBe(true);
    expect(health.minutesSinceLastSync).toBeGreaterThan(24 * 60);
  });

  it("suppresses stale warning when user is syncing on the expected interval at home", () => {
    const lastSyncedAt = new Date("2026-09-13T11:55:00Z");
    const health = resolveAgentSyncHealth(
      {
        lastSyncedAt,
        graceHours: 24,
        pulseAgentHealthy: true,
        pulsesLast24h: 120,
        expectedPulsesPerDay: expectedPerDay,
        deviceReferenceAt: registeredAt,
      },
      now,
    );
    expect(health.healthy).toBe(true);
    expect(health.showStaleWarning).toBe(false);
    expect(health.lowActivity).toBe(false);
  });
});

describe("low activity warnings", () => {
  const now = new Date("2026-09-13T12:00:00Z");

  it("suppresses warnings for devices registered under 24h", () => {
    const registeredAt = new Date("2026-09-13T00:00:00Z");
    expect(lowActivityThreshold(288, registeredAt, now)).toBeNull();
    expect(isLowActivityCount(5, 288, registeredAt, now)).toBe(false);
  });

  it("flags low activity after 24h using a scaled threshold", () => {
    const registeredAt = new Date("2026-09-10T12:00:00Z");
    expect(lowActivityThreshold(288, registeredAt, now)).toBe(28);
    expect(isLowActivityCount(10, 288, registeredAt, now)).toBe(true);
    expect(isLowActivityCount(40, 288, registeredAt, now)).toBe(false);
  });

  it("uses the earliest device registration reference", () => {
    const earlier = new Date("2026-09-01T10:00:00Z");
    const later = new Date("2026-09-10T10:00:00Z");
    expect(
      deviceRegistrationReferenceAt([
        { createdAt: later, lastSeenAt: null, installedAt: null },
        { createdAt: later, lastSeenAt: earlier, installedAt: null },
      ]),
    ).toEqual(earlier);
  });
});
