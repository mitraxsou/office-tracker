import { beforeEach, describe, expect, it, vi } from "vitest";

const heartbeatDeleteManyMock = vi.hoisted(() => vi.fn());
const activityTickDeleteManyMock = vi.hoisted(() => vi.fn());
const visitDeleteManyMock = vi.hoisted(() => vi.fn());
const agentApiHitDailyDeleteManyMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    heartbeat: { deleteMany: heartbeatDeleteManyMock },
    activityTick: { deleteMany: activityTickDeleteManyMock },
    visit: { deleteMany: visitDeleteManyMock },
    agentApiHitDaily: { deleteMany: agentApiHitDailyDeleteManyMock },
  },
}));

import { purgeOldHeartbeats } from "../src/lib/heartbeat-retention";

describe("purgeOldHeartbeats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    heartbeatDeleteManyMock.mockResolvedValue({ count: 3 });
    activityTickDeleteManyMock.mockResolvedValue({ count: 12 });
  });

  it("deletes legacy heartbeats and activity ticks older than retention", async () => {
    const result = await purgeOldHeartbeats(7);

    expect(heartbeatDeleteManyMock).toHaveBeenCalledWith({
      where: { recordedAt: { lt: expect.any(Date) } },
    });
    expect(activityTickDeleteManyMock).toHaveBeenCalledWith({
      where: { at: { lt: expect.any(Date) } },
    });
    expect(visitDeleteManyMock).not.toHaveBeenCalled();
    expect(agentApiHitDailyDeleteManyMock).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: 3, activityTicksDeleted: 12 });
  });

  it("skips purge when retention days are invalid", async () => {
    const result = await purgeOldHeartbeats(0);
    expect(result).toEqual({ deleted: 0, activityTicksDeleted: 0 });
    expect(heartbeatDeleteManyMock).not.toHaveBeenCalled();
    expect(activityTickDeleteManyMock).not.toHaveBeenCalled();
  });
});
