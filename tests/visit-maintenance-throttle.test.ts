import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const visitFindFirstMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    visit: { findFirst: visitFindFirstMock, update: vi.fn() },
    presenceTransition: { findMany: vi.fn().mockResolvedValue([]) },
    activityTick: { findFirst: vi.fn().mockResolvedValue(null) },
    heartbeat: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}));
vi.mock("@/lib/app-config", () => ({
  getAppConfig: vi.fn().mockResolvedValue({
    agentStaleMinutes: 15,
    agentMode: "events",
    officeSsids: ["OfficeConnect"],
  }),
  getEventModeAgentStaleMs: vi.fn().mockResolvedValue(70 * 60 * 1000),
  getAgentStaleMs: vi.fn().mockResolvedValue(15 * 60 * 1000),
}));
vi.mock("@/lib/activity-signal", () => ({
  getLastAgentSignalAt: vi.fn().mockResolvedValue(null),
  getLastAgentSignalOnDay: vi.fn().mockResolvedValue(null),
  resolveAgentSignalMode: vi.fn().mockResolvedValue({ useActivity: true }),
  agentModeUsesActivityTicks: (mode?: string | null) => (mode ?? "events") !== "heartbeat",
}));

import {
  maybeRunVisitMaintenance,
  resetVisitMaintenanceThrottle,
  VISIT_MAINTENANCE_THROTTLE_MS,
} from "@/lib/heartbeat-service";

describe("visit maintenance throttle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetVisitMaintenanceThrottle();
    visitFindFirstMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs maintenance on first call", async () => {
    const ran = await maybeRunVisitMaintenance("user-1", "Asia/Kolkata");
    expect(ran).toBe(true);
    expect(visitFindFirstMock).toHaveBeenCalled();
  });

  it("skips maintenance within the throttle window", async () => {
    await maybeRunVisitMaintenance("user-1", "Asia/Kolkata");
    visitFindFirstMock.mockClear();
    const ran = await maybeRunVisitMaintenance("user-1", "Asia/Kolkata");
    expect(ran).toBe(false);
    expect(visitFindFirstMock).not.toHaveBeenCalled();
  });

  it("forces maintenance when requested", async () => {
    await maybeRunVisitMaintenance("user-1", "Asia/Kolkata");
    visitFindFirstMock.mockClear();
    const ran = await maybeRunVisitMaintenance("user-1", "Asia/Kolkata", undefined, {
      force: true,
    });
    expect(ran).toBe(true);
    expect(visitFindFirstMock).toHaveBeenCalled();
  });

  it("runs again after the throttle window expires", async () => {
    vi.useFakeTimers();
    await maybeRunVisitMaintenance("user-1", "Asia/Kolkata");
    visitFindFirstMock.mockClear();
    vi.advanceTimersByTime(VISIT_MAINTENANCE_THROTTLE_MS + 1);
    const ran = await maybeRunVisitMaintenance("user-1", "Asia/Kolkata");
    expect(ran).toBe(true);
    expect(visitFindFirstMock).toHaveBeenCalled();
  });
});
