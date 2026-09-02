import { describe, expect, it } from "vitest";
import {
  compareFollowUpRows,
  matchesFollowUpStatusFilter,
  minutesSinceLastPulse,
  shouldIncludeDeviceForFollowUp,
} from "../src/lib/agent-follow-up";
import { computeDeviceAgentStatus } from "../src/lib/device-status";

describe("agent follow-up criteria", () => {
  const now = new Date("2026-09-02T10:00:00+05:30");
  const graceHours = 24;

  it("includes stale devices that had heartbeats and are not pending removal", () => {
    const lastSeen = new Date(now.getTime() - 30 * 60 * 60 * 1000);
    const status = computeDeviceAgentStatus(lastSeen, graceHours, now);
    expect(status).toBe("stale");
    expect(
      shouldIncludeDeviceForFollowUp({
        lastSeenAt: lastSeen,
        pendingRemoval: false,
        approvedRemoval: false,
        uninstalledAt: null,
        latestLifecycleEventType: "install",
        agentStatus: status,
      }),
    ).toBe(true);
  });

  it("includes offline devices that had heartbeats", () => {
    const lastSeen = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    const status = computeDeviceAgentStatus(lastSeen, graceHours, now);
    expect(status).toBe("offline");
    expect(
      shouldIncludeDeviceForFollowUp({
        lastSeenAt: lastSeen,
        pendingRemoval: false,
        approvedRemoval: false,
        uninstalledAt: null,
        latestLifecycleEventType: "install",
        agentStatus: status,
      }),
    ).toBe(true);
  });

  it("excludes healthy devices", () => {
    const lastSeen = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const status = computeDeviceAgentStatus(lastSeen, graceHours, now);
    expect(
      shouldIncludeDeviceForFollowUp({
        lastSeenAt: lastSeen,
        pendingRemoval: false,
        approvedRemoval: false,
        uninstalledAt: null,
        latestLifecycleEventType: "install",
        agentStatus: status,
      }),
    ).toBe(false);
  });

  it("excludes never-connected devices (registered but no lastSeenAt)", () => {
    expect(
      shouldIncludeDeviceForFollowUp({
        lastSeenAt: null,
        pendingRemoval: false,
        approvedRemoval: false,
        uninstalledAt: null,
        latestLifecycleEventType: null,
        agentStatus: "never",
      }),
    ).toBe(false);
  });

  it("excludes devices pending removal", () => {
    const lastSeen = new Date(now.getTime() - 30 * 60 * 1000);
    expect(
      shouldIncludeDeviceForFollowUp({
        lastSeenAt: lastSeen,
        pendingRemoval: true,
        approvedRemoval: false,
        uninstalledAt: null,
        latestLifecycleEventType: "install",
        agentStatus: "stale",
      }),
    ).toBe(false);
  });

  it("excludes uninstalled devices", () => {
    const lastSeen = new Date(now.getTime() - 30 * 60 * 1000);
    expect(
      shouldIncludeDeviceForFollowUp({
        lastSeenAt: lastSeen,
        pendingRemoval: false,
        approvedRemoval: false,
        uninstalledAt: new Date(now.getTime() - 60 * 60 * 1000),
        latestLifecycleEventType: "uninstall",
        agentStatus: "stale",
      }),
    ).toBe(false);
  });

  it("computes minutes since last pulse", () => {
    const lastSeen = new Date(now.getTime() - 45 * 60 * 1000);
    expect(minutesSinceLastPulse(lastSeen, now)).toBe(45);
    expect(minutesSinceLastPulse(null, now)).toBeNull();
  });

  it("filters by stale or offline", () => {
    expect(matchesFollowUpStatusFilter("stale", "all")).toBe(true);
    expect(matchesFollowUpStatusFilter("offline", "all")).toBe(true);
    expect(matchesFollowUpStatusFilter("stale", "stale")).toBe(true);
    expect(matchesFollowUpStatusFilter("offline", "stale")).toBe(false);
    expect(matchesFollowUpStatusFilter("offline", "offline")).toBe(true);
  });

  it("sorts offline before stale, then by stalest minutes", () => {
    const offline = {
      userId: "1",
      email: "a@example.com",
      name: null,
      devices: [],
      worstAgentStatus: "offline" as const,
      stalestMinutesSinceLastPulse: 100,
    };
    const stale = {
      userId: "2",
      email: "b@example.com",
      name: null,
      devices: [],
      worstAgentStatus: "stale" as const,
      stalestMinutesSinceLastPulse: 500,
    };
    const staleOlder = {
      userId: "3",
      email: "c@example.com",
      name: null,
      devices: [],
      worstAgentStatus: "stale" as const,
      stalestMinutesSinceLastPulse: 200,
    };

    expect(compareFollowUpRows(offline, stale)).toBeLessThan(0);
    expect(compareFollowUpRows(stale, staleOlder)).toBeLessThan(0);
  });
});
