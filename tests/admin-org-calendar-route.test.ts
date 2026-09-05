import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getAdminOrgCalendarDays: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/admin-reports", () => ({
  getAdminOrgCalendarDays: mocks.getAdminOrgCalendarDays,
}));

import { GET } from "../src/app/api/admin/reports/calendar/route";

describe("GET /api/admin/reports/calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "admin1", email: "admin@example.com" });
    mocks.getAdminOrgCalendarDays.mockResolvedValue({
      monthKey: "2026-09",
      timezone: "Asia/Kolkata",
      days: [],
    });
  });

  it("returns 403 when not admin", async () => {
    mocks.requireAdmin.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/admin/reports/calendar?month=2026-09"));
    expect(res.status).toBe(403);
  });

  it("returns calendar days for valid month", async () => {
    const res = await GET(new Request("http://localhost/api/admin/reports/calendar?month=2026-09"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.monthKey).toBe("2026-09");
    expect(mocks.getAdminOrgCalendarDays).toHaveBeenCalledWith("2026-09", "Asia/Kolkata");
  });

  it("rejects invalid month format", async () => {
    const res = await GET(new Request("http://localhost/api/admin/reports/calendar?month=bad"));
    expect(res.status).toBe(400);
  });
});
