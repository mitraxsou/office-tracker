import { describe, expect, it } from "vitest";
import {
  isDeviceExcludedFromFollowUp,
  isInstallLikeLifecycleEvent,
  resolveHeartbeatLifecycleEventType,
} from "../src/lib/agent-lifecycle";

describe("agent lifecycle helpers", () => {
  it("resolves install for newly registered devices", () => {
    expect(
      resolveHeartbeatLifecycleEventType({
        registered: true,
        uninstalledAt: null,
        installedAt: null,
      }),
    ).toBe("install");
  });

  it("resolves reinstall after uninstall", () => {
    expect(
      resolveHeartbeatLifecycleEventType({
        registered: false,
        uninstalledAt: new Date("2026-09-01T10:00:00Z"),
        installedAt: new Date("2026-08-01T10:00:00Z"),
      }),
    ).toBe("reinstall");
  });

  it("resolves first_heartbeat when device exists without installedAt", () => {
    expect(
      resolveHeartbeatLifecycleEventType({
        registered: false,
        uninstalledAt: null,
        installedAt: null,
      }),
    ).toBe("first_heartbeat");
  });

  it("returns null for routine heartbeats", () => {
    expect(
      resolveHeartbeatLifecycleEventType({
        registered: false,
        uninstalledAt: null,
        installedAt: new Date("2026-08-01T10:00:00Z"),
      }),
    ).toBeNull();
  });

  it("identifies install-like lifecycle events", () => {
    expect(isInstallLikeLifecycleEvent("install")).toBe(true);
    expect(isInstallLikeLifecycleEvent("reinstall")).toBe(true);
    expect(isInstallLikeLifecycleEvent("uninstall")).toBe(false);
  });
});

describe("follow-up exclusion from lifecycle", () => {
  const lastSeen = new Date("2026-09-01T10:00:00Z");

  it("excludes uninstalled devices", () => {
    expect(
      isDeviceExcludedFromFollowUp({
        uninstalledAt: new Date("2026-09-02T08:00:00Z"),
        latestLifecycleEventType: "uninstall",
        pendingRemoval: false,
        approvedRemoval: false,
        lastSeenAt: lastSeen,
      }),
    ).toBe(true);
  });

  it("excludes devices whose latest event is uninstall", () => {
    expect(
      isDeviceExcludedFromFollowUp({
        uninstalledAt: null,
        latestLifecycleEventType: "uninstall",
        pendingRemoval: false,
        approvedRemoval: false,
        lastSeenAt: lastSeen,
      }),
    ).toBe(true);
  });

  it("excludes devices pending or approved for removal", () => {
    expect(
      isDeviceExcludedFromFollowUp({
        uninstalledAt: null,
        latestLifecycleEventType: "install",
        pendingRemoval: true,
        approvedRemoval: false,
        lastSeenAt: lastSeen,
      }),
    ).toBe(true);
    expect(
      isDeviceExcludedFromFollowUp({
        uninstalledAt: null,
        latestLifecycleEventType: "install",
        pendingRemoval: false,
        approvedRemoval: true,
        lastSeenAt: lastSeen,
      }),
    ).toBe(true);
  });

  it("excludes never-connected devices", () => {
    expect(
      isDeviceExcludedFromFollowUp({
        uninstalledAt: null,
        latestLifecycleEventType: null,
        pendingRemoval: false,
        approvedRemoval: false,
        lastSeenAt: null,
      }),
    ).toBe(true);
  });

  it("includes active installed devices", () => {
    expect(
      isDeviceExcludedFromFollowUp({
        uninstalledAt: null,
        latestLifecycleEventType: "install",
        pendingRemoval: false,
        approvedRemoval: false,
        lastSeenAt: lastSeen,
      }),
    ).toBe(false);
  });
});
