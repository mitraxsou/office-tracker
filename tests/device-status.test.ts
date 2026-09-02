import { describe, expect, it } from "vitest";
import { computeDeviceAgentStatus, agentStatusLabel } from "../src/lib/device-status";

describe("device agent status", () => {
  const now = new Date("2026-09-02T10:00:00+05:30");
  const graceHours = 24;

  it("returns never when no lastSeenAt", () => {
    expect(computeDeviceAgentStatus(null, graceHours, now)).toBe("never");
  });

  it("returns healthy within grace window", () => {
    const lastSeen = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    expect(computeDeviceAgentStatus(lastSeen, graceHours, now)).toBe("healthy");
  });

  it("returns stale after grace window but within 7 days", () => {
    const lastSeen = new Date(now.getTime() - 30 * 60 * 60 * 1000);
    expect(computeDeviceAgentStatus(lastSeen, graceHours, now)).toBe("stale");
  });

  it("returns offline after 7 days", () => {
    const lastSeen = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    expect(computeDeviceAgentStatus(lastSeen, graceHours, now)).toBe("offline");
  });

  it("labels statuses", () => {
    expect(agentStatusLabel("healthy")).toBe("Healthy");
    expect(agentStatusLabel("stale")).toBe("Stale");
  });
});
