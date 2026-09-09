import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, upsert } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("../src/lib/db", () => ({
  prisma: {
    alertDispatch: {
      findUnique,
      upsert,
    },
  },
}));

import {
  filterUndispatchedAlertTypes,
  recordAlertDispatches,
  wasAlertDispatchedToday,
} from "../src/lib/alert-dispatch";

describe("alert-dispatch dedup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wasAlertDispatchedToday uses indexed AlertDispatch lookup", async () => {
    findUnique.mockResolvedValue({ id: "row-1" });
    await expect(wasAlertDispatchedToday("user-1", "hours_met", "2026-09-09")).resolves.toBe(
      true,
    );
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        userId_type_dayKey: { userId: "user-1", type: "hours_met", dayKey: "2026-09-09" },
      },
      select: { id: true },
    });
  });

  it("recordAlertDispatches upserts each pending alert", async () => {
    upsert.mockResolvedValue({});
    await recordAlertDispatches([
      { userId: "user-1", type: "hours_started", dayKey: "2026-09-09" },
    ]);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("filterUndispatchedAlertTypes drops types already sent today", async () => {
    findUnique.mockImplementation(async ({ where }) => {
      if (where.userId_type_dayKey.type === "hours_started") return { id: "x" };
      return null;
    });
    const pending = await filterUndispatchedAlertTypes("user-1", "2026-09-09", [
      "hours_started",
      "hours_met",
    ]);
    expect(pending).toEqual(["hours_met"]);
  });
});
