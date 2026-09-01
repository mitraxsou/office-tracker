import { describe, expect, it } from "vitest";
import { computeDeviceAgentStatus, agentStatusLabel } from "../src/lib/device-status";

describe("device agent status", () => {
  const now = new Date("2026-09-02T10:00:00+05:30");
  const staleMinutes = 8;

  it("returns never when no lastSeenAt", () => {
    expect(computeDeviceAgentStatus(null, staleMinutes, now)).toBe("never");
  });

  it("returns healthy within stale window", () => {
    const lastSeen = new Date(now.getTime() - 5 * 60 * 1000);
    expect(computeDeviceAgentStatus(lastSeen, staleMinutes, now)).toBe("healthy");
  });

  it("returns stale after stale window but within 24h", () => {
    const lastSeen = new Date(now.getTime() - 30 * 60 * 1000);
    expect(computeDeviceAgentStatus(lastSeen, staleMinutes, now)).toBe("stale");
  });

  it("returns offline after 24h", () => {
    const lastSeen = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    expect(computeDeviceAgentStatus(lastSeen, staleMinutes, now)).toBe("offline");
  });

  it("labels statuses", () => {
    expect(agentStatusLabel("healthy")).toBe("Healthy");
    expect(agentStatusLabel("stale")).toBe("Stale");
  });
});
