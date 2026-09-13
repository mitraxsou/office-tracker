import { beforeEach, describe, expect, it, vi } from "vitest";

const visitFindFirstMock = vi.hoisted(() => vi.fn());
const visitUpdateMock = vi.hoisted(() => vi.fn());
const presenceTransitionFindManyMock = vi.hoisted(() => vi.fn());
const resolveAgentSignalModeMock = vi.hoisted(() => vi.fn());
const getLastAgentSignalOnDayMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    visit: {
      findFirst: visitFindFirstMock,
      update: visitUpdateMock,
    },
    presenceTransition: {
      findMany: presenceTransitionFindManyMock,
    },
  },
}));
vi.mock("@/lib/app-config", () => ({
  getAppConfig: vi.fn().mockResolvedValue({
    officeSsids: ["OfficeConnect", "ExternalConnect"],
    agentStaleMinutes: 15,
  }),
}));
vi.mock("@/lib/activity-signal", () => ({
  resolveAgentSignalMode: resolveAgentSignalModeMock,
  getLastAgentSignalOnDay: getLastAgentSignalOnDayMock,
}));

import { closeEndOfDayOpenVisits } from "../src/lib/heartbeat-service";

describe("closeEndOfDayOpenVisits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAgentSignalModeMock.mockResolvedValue({ useActivity: true });
    getLastAgentSignalOnDayMock.mockResolvedValue(null);
    presenceTransitionFindManyMock.mockResolvedValue([]);
  });

  it("closes a prior-day open visit at office Wi-Fi disconnect time", async () => {
    const startAt = new Date("2026-09-12T04:30:00.000Z");
    const disconnectAt = new Date("2026-09-12T14:00:00.000Z");
    visitFindFirstMock.mockResolvedValue({
      id: "visit-1",
      userId: "user-1",
      startAt,
      endAt: null,
      updatedAt: startAt,
    });
    presenceTransitionFindManyMock.mockResolvedValue([
      {
        at: disconnectAt,
        type: "ssid_changed",
        previousSsid: "OfficeConnect",
      },
    ]);
    visitUpdateMock.mockResolvedValue({});

    const closed = await closeEndOfDayOpenVisits("user-1", "Asia/Kolkata");

    expect(closed).toBe(true);
    expect(visitUpdateMock).toHaveBeenCalledWith({
      where: { id: "visit-1" },
      data: { endAt: disconnectAt },
    });
  });

  it("does not close visits that started today", async () => {
    const now = new Date("2026-09-13T06:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    visitFindFirstMock.mockResolvedValue({
      id: "visit-2",
      userId: "user-1",
      startAt: new Date("2026-09-13T04:00:00.000Z"),
      endAt: null,
      updatedAt: new Date("2026-09-13T04:00:00.000Z"),
    });

    const closed = await closeEndOfDayOpenVisits("user-1", "Asia/Kolkata");

    expect(closed).toBe(false);
    expect(visitUpdateMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("caps end time at day boundary when disconnect is missing", async () => {
    const startAt = new Date("2026-09-11T04:30:00.000Z");
    const lastTick = new Date("2026-09-11T16:00:00.000Z");
    visitFindFirstMock.mockResolvedValue({
      id: "visit-3",
      userId: "user-1",
      startAt,
      endAt: null,
      updatedAt: lastTick,
    });
    getLastAgentSignalOnDayMock.mockResolvedValue(lastTick);
    visitUpdateMock.mockResolvedValue({});

    const closed = await closeEndOfDayOpenVisits("user-1", "Asia/Kolkata");

    expect(closed).toBe(true);
    const updateCall = visitUpdateMock.mock.calls[0][0];
    expect(updateCall.data.endAt.getTime()).toBeLessThanOrEqual(
      new Date("2026-09-11T18:29:59.999Z").getTime(),
    );
  });
});
