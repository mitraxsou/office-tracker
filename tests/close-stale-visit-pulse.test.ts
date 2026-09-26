import { beforeEach, describe, expect, it, vi } from "vitest";

const visitFindFirstMock = vi.hoisted(() => vi.fn());
const visitUpdateMock = vi.hoisted(() => vi.fn());
const agentEventFindFirstMock = vi.hoisted(() => vi.fn());
const activityTickFindFirstMock = vi.hoisted(() => vi.fn());
const getLastAgentSignalAtMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    visit: {
      findFirst: visitFindFirstMock,
      update: visitUpdateMock,
    },
    agentEvent: { findFirst: agentEventFindFirstMock },
    activityTick: { findFirst: activityTickFindFirstMock },
    heartbeat: { findFirst: vi.fn() },
    presenceTransition: { findMany: vi.fn() },
    dailySummary: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/lib/app-config", () => ({
  getAppConfig: vi.fn().mockResolvedValue({
    agentMode: "events",
    agentStaleMinutes: 15,
    officeSsids: ["OfficeConnect"],
  }),
  getEventModeAgentStaleMs: vi.fn().mockResolvedValue(70 * 60 * 1000),
  getAgentStaleMs: vi.fn().mockResolvedValue(15 * 60 * 1000),
  getUserHoursTarget: vi.fn().mockResolvedValue(5),
  getEffectiveAgentStaleGraceHours: vi.fn().mockResolvedValue(24),
}));

vi.mock("@/lib/activity-signal", () => ({
  getLastAgentSignalAt: getLastAgentSignalAtMock,
  getLastAgentSignalOnDay: vi.fn().mockResolvedValue(null),
  agentModeUsesActivityTicks: () => true,
  activityTickToSignal: vi.fn(),
  heartbeatToSignal: vi.fn(),
}));

import { closeStaleOpenVisits } from "../src/lib/heartbeat-service";

describe("closeStaleOpenVisits with last confirmed pulse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    visitUpdateMock.mockResolvedValue({});
    agentEventFindFirstMock.mockResolvedValue(null);
    activityTickFindFirstMock.mockResolvedValue(null);
  });

  it("does not close an open visit when a recent health signal is present", async () => {
    visitFindFirstMock.mockResolvedValue({
      id: "visit-1",
      startAt: new Date("2026-09-25T04:00:00.000Z"),
      updatedAt: new Date("2026-09-25T04:00:00.000Z"),
      endAt: null,
    });
    getLastAgentSignalAtMock.mockResolvedValue(new Date());

    const closed = await closeStaleOpenVisits("user-1", undefined, {
      lastConfirmedPulseAt: new Date("2026-09-25T09:58:00.000Z"),
    });

    expect(closed).toBe(false);
    expect(visitUpdateMock).not.toHaveBeenCalled();
  });

  it("closes a stale visit at the last confirmed local pulse, not detection time", async () => {
    const lastPulse = new Date("2026-09-25T10:34:00.000Z");
    visitFindFirstMock.mockResolvedValue({
      id: "visit-1",
      startAt: new Date("2026-09-25T04:00:00.000Z"),
      updatedAt: new Date("2026-09-25T04:00:00.000Z"),
      endAt: null,
    });
    getLastAgentSignalAtMock.mockResolvedValue(new Date("2026-09-25T10:34:00.000Z"));

    const closed = await closeStaleOpenVisits("user-1", 60 * 1000, {
      lastConfirmedPulseAt: lastPulse,
    });

    expect(closed).toBe(true);
    expect(visitUpdateMock).toHaveBeenCalledWith({
      where: { id: "visit-1" },
      data: { endAt: lastPulse },
    });
  });
});
