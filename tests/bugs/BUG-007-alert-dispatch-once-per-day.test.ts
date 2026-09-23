import { readFileSync } from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectHeartbeatAlertTypes } from "@/lib/heartbeat-alerts";

const { findUnique } = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    alertDispatch: {
      findUnique,
      upsert: vi.fn(),
    },
  },
}));

import { filterUndispatchedAlertTypes } from "@/lib/alert-dispatch";

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests/bugs/fixtures/alert-dispatch-once-per-day.json"),
    "utf8",
  ),
) as {
  userId: string;
  dayKey: string;
  alreadyDispatched: string[];
  candidateTypes: string[];
  expectedPending: string[];
};

describe("BUG-007 monthly_snapshot / hours_met once-per-day", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters types already recorded on AlertDispatch for the dayKey", async () => {
    findUnique.mockImplementation(async ({ where }: { where: { userId_type_dayKey: { type: string } } }) => {
      if (fixture.alreadyDispatched.includes(where.userId_type_dayKey.type)) {
        return { id: "row" };
      }
      return null;
    });

    const pending = await filterUndispatchedAlertTypes(
      fixture.userId,
      fixture.dayKey,
      fixture.candidateTypes as ("hours_started" | "hours_met" | "monthly_snapshot")[],
    );
    expect(pending).toEqual(fixture.expectedPending);
  });

  it("selectHeartbeatAlertTypes skips hours_met and monthly_snapshot when already sent", () => {
    expect(
      selectHeartbeatAlertTypes({
        inOffice: true,
        oooCleared: false,
        metTarget: true,
        hoursStartedSent: true,
        hoursMetSent: true,
        monthlySnapshotSent: true,
      }),
    ).toEqual([]);

    expect(
      selectHeartbeatAlertTypes({
        inOffice: true,
        oooCleared: false,
        metTarget: false,
        hoursStartedSent: true,
        hoursMetSent: true,
        monthlySnapshotSent: false,
      }),
    ).toEqual(["monthly_snapshot"]);
  });
});
