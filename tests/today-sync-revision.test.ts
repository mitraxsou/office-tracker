import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTodaySyncRevision } from "@/lib/today-sync-revision";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  loadTodaySyncRevisionForUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/today-sync-revision", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/today-sync-revision")>();
  return {
    ...actual,
    loadTodaySyncRevisionForUser: mocks.loadTodaySyncRevisionForUser,
  };
});

import { GET } from "@/app/api/today/sync-revision/route";

describe("buildTodaySyncRevision", () => {
  const base = {
    lastSyncedAt: new Date("2026-10-26T06:00:00.000Z"),
    lastSignalAt: new Date("2026-10-26T06:00:00.000Z"),
    lastSignalInOffice: true,
    openVisitId: "visit-1",
    openVisitStartAt: new Date("2026-10-26T04:30:00.000Z"),
    latestClosedVisitEndAt: null as Date | null,
  };

  it("returns the same revision for identical inputs", () => {
    expect(buildTodaySyncRevision(base)).toBe(buildTodaySyncRevision({ ...base }));
  });

  it("changes when lastSyncedAt advances", () => {
    const before = buildTodaySyncRevision(base);
    const after = buildTodaySyncRevision({
      ...base,
      lastSyncedAt: new Date("2026-10-26T06:02:00.000Z"),
    });
    expect(after).not.toBe(before);
  });

  it("changes when heartbeat / signal advances", () => {
    const before = buildTodaySyncRevision(base);
    const after = buildTodaySyncRevision({
      ...base,
      lastSignalAt: new Date("2026-10-26T06:05:00.000Z"),
      lastSignalInOffice: false,
    });
    expect(after).not.toBe(before);
  });

  it("does not depend on wall-clock alone (same inputs stay equal)", () => {
    const a = buildTodaySyncRevision(base);
    const b = buildTodaySyncRevision({
      ...base,
      lastSyncedAt: "2026-10-26T06:00:00.000Z",
      lastSignalAt: "2026-10-26T06:00:00.000Z",
      openVisitStartAt: "2026-10-26T04:30:00.000Z",
    });
    expect(a).toBe(b);
  });
});

describe("GET /api/today/sync-revision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a signed-in user", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mocks.loadTodaySyncRevisionForUser).not.toHaveBeenCalled();
  });

  it("returns revision for the current user", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      agentDevices: [{ lastSeenAt: new Date("2026-10-26T06:00:00.000Z") }],
    });
    mocks.loadTodaySyncRevisionForUser.mockResolvedValue("rev-abc");

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ revision: "rev-abc" });
    expect(mocks.loadTodaySyncRevisionForUser).toHaveBeenCalledWith(
      "user-1",
      [{ lastSeenAt: new Date("2026-10-26T06:00:00.000Z") }],
    );
  });
});
