import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const agentApiHitDailyUpsertMock = vi.hoisted(() => vi.fn());
const agentApiHitDailyFindManyMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    agentApiHitDaily: {
      upsert: agentApiHitDailyUpsertMock,
      findMany: agentApiHitDailyFindManyMock,
    },
  },
}));

import {
  AGENT_API_ROUTES,
  getDeviceAgentApiHitTotals,
  getUserAgentApiHitTotals,
  recordAgentApiHit,
} from "../src/lib/agent-api-hits";

afterEach(() => {
  vi.useRealTimers();
});

describe("recordAgentApiHit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentApiHitDailyUpsertMock.mockResolvedValue({});
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T10:00:00.000Z"));
  });

  it("upserts a daily counter for sync hits", async () => {
    await recordAgentApiHit({
      userId: "user-1",
      deviceId: "device-1",
      route: AGENT_API_ROUTES.SYNC,
      timezone: "Asia/Kolkata",
    });

    expect(agentApiHitDailyUpsertMock).toHaveBeenCalledWith({
      where: {
        userId_deviceId_route_dayKey: {
          userId: "user-1",
          deviceId: "device-1",
          route: AGENT_API_ROUTES.SYNC,
          dayKey: "2026-09-13",
        },
      },
      create: {
        userId: "user-1",
        deviceId: "device-1",
        route: AGENT_API_ROUTES.SYNC,
        dayKey: "2026-09-13",
        hitCount: 1,
      },
      update: {
        hitCount: { increment: 1 },
      },
    });
  });

  it("stores empty device id when device is missing", async () => {
    await recordAgentApiHit({
      userId: "user-1",
      route: AGENT_API_ROUTES.CONFIG,
      timezone: "Asia/Kolkata",
    });

    expect(agentApiHitDailyUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_deviceId_route_dayKey: expect.objectContaining({
            deviceId: "",
          }),
        },
      }),
    );
  });
});

describe("getUserAgentApiHitTotals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T10:00:00.000Z"));
  });

  it("rolls up day, month, and year totals", async () => {
    agentApiHitDailyFindManyMock.mockResolvedValue([
      { route: AGENT_API_ROUTES.SYNC, dayKey: "2026-09-13", hitCount: 4 },
      { route: AGENT_API_ROUTES.SYNC, dayKey: "2026-09-12", hitCount: 2 },
      { route: AGENT_API_ROUTES.HEARTBEAT, dayKey: "2026-08-20", hitCount: 5 },
      { route: AGENT_API_ROUTES.CONFIG, dayKey: "2025-12-31", hitCount: 99 },
    ]);

    const totals = await getUserAgentApiHitTotals("user-1", "Asia/Kolkata");

    expect(totals.day).toBe(4);
    expect(totals.month).toBe(6);
    expect(totals.year).toBe(11);
    expect(totals.byRoute[AGENT_API_ROUTES.SYNC]).toEqual({ day: 4, month: 6, year: 6 });
    expect(totals.byRoute[AGENT_API_ROUTES.HEARTBEAT]).toEqual({ day: 0, month: 0, year: 5 });
  });
});

describe("getDeviceAgentApiHitTotals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T10:00:00.000Z"));
  });

  it("scopes totals to one device", async () => {
    agentApiHitDailyFindManyMock.mockResolvedValue([
      { route: AGENT_API_ROUTES.SYNC, dayKey: "2026-09-13", hitCount: 3 },
    ]);

    const totals = await getDeviceAgentApiHitTotals("device-1", "Asia/Kolkata");

    expect(agentApiHitDailyFindManyMock).toHaveBeenCalledWith({
      where: {
        deviceId: "device-1",
        dayKey: { gte: "2026-01-01", lte: "2026-12-31" },
      },
      select: { route: true, dayKey: true, hitCount: true },
    });
    expect(totals.day).toBe(3);
    expect(totals.month).toBe(3);
    expect(totals.year).toBe(3);
  });
});
