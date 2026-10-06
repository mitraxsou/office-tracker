import { beforeEach, describe, expect, it, vi } from "vitest";

const agentEventFindManyMock = vi.hoisted(() => vi.fn());
const visitFindFirstMock = vi.hoisted(() => vi.fn());
const visitUpdateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    agentEvent: { findMany: agentEventFindManyMock },
    visit: { findFirst: visitFindFirstMock, update: visitUpdateMock },
  },
}));

import { persistRecoveredWifiVisitStarts } from "@/lib/office-visit-recovery-persist";

describe("persist recovered wifi visit starts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    visitUpdateMock.mockResolvedValue({});
  });

  it("backdates an open wifi visit from an accepted visit_start payload on Today load", async () => {
    agentEventFindManyMock.mockResolvedValue([
      {
        deviceId: "device-1",
        payload: {
          id: "evt-recover",
          type: "visit_start",
          at: "2026-10-06T09:19:36.000Z",
          localVisitId: "lv-1",
          ssid: "OfficeConnect",
        },
      },
    ]);
    visitFindFirstMock.mockResolvedValue({
      id: "visit-late",
      source: "wifi",
      startAt: new Date("2026-10-06T10:08:00.000Z"),
      endAt: null,
    });

    const updated = await persistRecoveredWifiVisitStarts(
      "user-1",
      "Asia/Kolkata",
      new Date("2026-10-06T12:04:00.000Z"),
    );

    expect(updated).toBe(1);
    expect(visitUpdateMock).toHaveBeenCalledWith({
      where: { id: "visit-late" },
      data: expect.objectContaining({ startAt: new Date("2026-10-06T09:19:36.000Z") }),
    });
  });

  it("does not change a closed manual visit", async () => {
    agentEventFindManyMock.mockResolvedValue([
      {
        deviceId: "device-1",
        payload: {
          type: "visit_start",
          at: "2026-10-06T09:19:36.000Z",
          localVisitId: "lv-manual",
          ssid: "OfficeConnect",
        },
      },
    ]);
    visitFindFirstMock.mockResolvedValue({
      id: "visit-manual",
      source: "manual",
      startAt: new Date("2026-10-06T10:08:00.000Z"),
      endAt: new Date("2026-10-06T11:00:00.000Z"),
    });

    const updated = await persistRecoveredWifiVisitStarts(
      "user-1",
      "Asia/Kolkata",
      new Date("2026-10-06T12:04:00.000Z"),
    );

    expect(updated).toBe(0);
    expect(visitUpdateMock).not.toHaveBeenCalled();
  });
});
