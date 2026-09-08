import { describe, expect, it } from "vitest";
import {
  isUserAgentDeregistered,
  userHasInstalledAgentForStaleChecks,
} from "../src/lib/agent-deregister";
import { wasAgentStaleAtDayEnd } from "../src/lib/admin-day-compliance";

describe("userHasInstalledAgentForStaleChecks", () => {
  it("returns false when the user agent is deregistered", () => {
    expect(
      userHasInstalledAgentForStaleChecks({
        agentDeregisteredAt: new Date("2026-09-01T10:00:00Z"),
        agentDevices: [{ lastSeenAt: new Date("2026-09-08T10:00:00Z") }],
      }),
    ).toBe(false);
  });

  it("returns true when devices have heartbeats and agent is active", () => {
    expect(
      userHasInstalledAgentForStaleChecks({
        agentDeregisteredAt: null,
        agentDevices: [{ lastSeenAt: new Date("2026-09-08T10:00:00Z") }],
      }),
    ).toBe(true);
  });

  it("returns false when no device has ever connected", () => {
    expect(
      userHasInstalledAgentForStaleChecks({
        agentDeregisteredAt: null,
        agentDevices: [{ lastSeenAt: null }],
      }),
    ).toBe(false);
  });
});

describe("isUserAgentDeregistered", () => {
  it("detects deregistered users", () => {
    expect(isUserAgentDeregistered(new Date())).toBe(true);
    expect(isUserAgentDeregistered(null)).toBe(false);
    expect(isUserAgentDeregistered(undefined)).toBe(false);
  });
});

describe("stale checks with deregistered users", () => {
  const dayEnd = new Date("2026-09-04T18:29:59.999+05:30");

  it("does not mark deregistered users as stale even without recent pulses", () => {
    expect(
      wasAgentStaleAtDayEnd({
        dayKey: "2026-09-04",
        dayEnd,
        lastHeartbeatBeforeDayEnd: null,
        graceHours: 24,
        hadInstalledDevice: userHasInstalledAgentForStaleChecks({
          agentDeregisteredAt: new Date("2026-09-01T10:00:00Z"),
          agentDevices: [{ lastSeenAt: new Date("2026-09-01T09:00:00Z") }],
        }),
      }),
    ).toBe(false);
  });
});
