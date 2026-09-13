import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  requireAdmin: vi.fn(),
  getNotificationPrefs: vi.fn(),
  analyzeScheduleForUser: vi.fn(),
  findUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/admin", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/notification-prefs-server", () => ({
  getNotificationPrefs: mocks.getNotificationPrefs,
}));

vi.mock("@/lib/office-schedule-sync", () => ({
  analyzeScheduleForUser: mocks.analyzeScheduleForUser,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUser,
    },
  },
}));

import { GET as getUserSuggestion } from "../src/app/api/settings/schedule-suggestion/route";
import { GET as getAdminSuggestion } from "../src/app/api/admin/users/[id]/schedule-suggestion/route";
import { insufficientHistoryMessage } from "../src/components/OfficeScheduleSuggestionCard";

const prefs = {
  workDays: [3, 5],
  officeStartTime: "09:30",
  officeEndTime: "18:00",
};

const insufficientAnalysis = {
  status: "insufficient_history",
  suggestion: null,
  inferred: null,
  officeDaysFound: 2,
  qualifyingOfficeDays: 0,
  weekdayCounts: [
    { weekday: 3, officeDays: 1, occurrences: 8 },
    { weekday: 5, officeDays: 1, occurrences: 8 },
  ],
  windowStartDayKey: "2026-07-09",
  windowEndDayKey: "2026-09-02",
};

const suggestionAnalysis = {
  status: "suggestion",
  suggestion: {
    workDays: [3],
    officeStartTime: "10:00",
    officeEndTime: "18:15",
  },
  inferred: {
    workDays: [3],
    officeStartTime: "10:00",
    officeEndTime: "18:15",
  },
  officeDaysFound: 4,
  qualifyingOfficeDays: 3,
  weekdayCounts: [{ weekday: 3, officeDays: 3, occurrences: 8 }],
  windowStartDayKey: "2026-07-09",
  windowEndDayKey: "2026-09-02",
};

describe("user schedule suggestion endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getNotificationPrefs.mockResolvedValue(prefs);
  });

  it("requires a signed-in user", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await getUserSuggestion();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mocks.analyzeScheduleForUser).not.toHaveBeenCalled();
  });

  it("returns an explicit insufficient-history result", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      timezone: "Asia/Kolkata",
    });
    mocks.analyzeScheduleForUser.mockResolvedValue(insufficientAnalysis);

    const response = await getUserSuggestion();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ analysis: insufficientAnalysis });
    expect(insufficientHistoryMessage(2)).toContain("Found 2 office days");
  });

  it("returns a suggestion when history supports one", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      timezone: "Asia/Kolkata",
    });
    mocks.analyzeScheduleForUser.mockResolvedValue(suggestionAnalysis);

    const response = await getUserSuggestion();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ analysis: suggestionAnalysis });
    expect(mocks.analyzeScheduleForUser).toHaveBeenCalledWith(
      "user-1",
      "Asia/Kolkata",
      prefs,
    );
  });
});

describe("admin schedule suggestion endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getNotificationPrefs.mockResolvedValue(prefs);
  });

  it("requires an admin", async () => {
    mocks.requireAdmin.mockResolvedValue(null);
    const response = await getAdminSuggestion(
      new Request("https://example.local"),
      { params: Promise.resolve({ id: "user-1" }) },
    );
    expect(response.status).toBe(403);
    expect(mocks.findUser).not.toHaveBeenCalled();
  });

  it("returns the target user's analysis", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin-1", role: "admin" });
    mocks.findUser.mockResolvedValue({ id: "user-1", timezone: "Asia/Kolkata" });
    mocks.analyzeScheduleForUser.mockResolvedValue(suggestionAnalysis);

    const response = await getAdminSuggestion(
      new Request("https://example.local"),
      { params: Promise.resolve({ id: "user-1" }) },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ analysis: suggestionAnalysis });
  });
});
