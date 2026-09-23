import { beforeEach, describe, expect, it, vi } from "vitest";

const { maybeClearOutOfOfficeOnOfficePresence } = vi.hoisted(() => ({
  maybeClearOutOfOfficeOnOfficePresence: vi.fn(),
}));

const { dispatchUserAlerts } = vi.hoisted(() => ({
  dispatchUserAlerts: vi.fn(),
}));

const { filterUndispatchedAlertTypes } = vi.hoisted(() => ({
  filterUndispatchedAlertTypes: vi.fn(),
}));

vi.mock("../src/lib/out-of-office", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/out-of-office")>();
  return {
    ...actual,
    maybeClearOutOfOfficeOnOfficePresence,
  };
});

vi.mock("../src/lib/power-automate-notify", () => ({
  dispatchUserAlerts,
}));

vi.mock("../src/lib/alert-dispatch", () => ({
  filterUndispatchedAlertTypes,
}));

import { handleOfficePresenceDetected } from "../src/lib/ooo-presence";

describe("handleOfficePresenceDetected", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dispatchUserAlerts.mockResolvedValue({ ok: true });
    filterUndispatchedAlertTypes.mockImplementation(async (_userId, _dayKey, types) => types);
  });

  it("dispatches ooo_cleared when OOO was cleared", async () => {
    maybeClearOutOfOfficeOnOfficePresence.mockResolvedValue({
      cleared: true,
      dayKey: "2026-09-08",
    });

    await handleOfficePresenceDetected("user-1", "Asia/Kolkata");

    expect(dispatchUserAlerts).toHaveBeenCalledWith("user-1", [
      "ooo_cleared",
      "hours_started",
      "monthly_snapshot",
      "hours_met",
    ]);
  });

  it("skips ooo_cleared when user was not marked OOO", async () => {
    maybeClearOutOfOfficeOnOfficePresence.mockResolvedValue({
      cleared: false,
      dayKey: "2026-09-08",
    });

    await handleOfficePresenceDetected("user-1", "Asia/Kolkata");

    expect(dispatchUserAlerts).toHaveBeenCalledWith("user-1", [
      "hours_started",
      "monthly_snapshot",
      "hours_met",
    ]);
  });
});
