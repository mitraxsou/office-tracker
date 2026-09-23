import { beforeEach, describe, expect, it, vi } from "vitest";

const heartbeatFindManyMock = vi.hoisted(() => vi.fn());
const activityTickFindFirstMock = vi.hoisted(() => vi.fn());
const visitFindFirstMock = vi.hoisted(() => vi.fn());
const wasAlertDispatchedTodayMock = vi.hoisted(() => vi.fn());
const getNotificationPrefsMock = vi.hoisted(() => vi.fn());
const getTodaySummaryMock = vi.hoisted(() => vi.fn());
const getPulseStatsMock = vi.hoisted(() => vi.fn());
const isUserOutOfOfficeMock = vi.hoisted(() => vi.fn());
const buildOutOfOfficeLinkUrlMock = vi.hoisted(() => vi.fn());
const getMonthlyProgressMock = vi.hoisted(() => vi.fn());

vi.mock("../src/lib/db", () => ({
  prisma: {
    heartbeat: { findMany: heartbeatFindManyMock },
    activityTick: { findFirst: activityTickFindFirstMock },
    visit: { findFirst: visitFindFirstMock },
  },
}));

vi.mock("../src/lib/alert-dispatch", () => ({
  wasAlertDispatchedToday: wasAlertDispatchedTodayMock,
  recordAlertDispatches: vi.fn(),
}));

vi.mock("../src/lib/app-config", () => ({
  getAppConfig: vi.fn().mockResolvedValue({
    officeSsids: ["OfficeConnect"],
    agentStaleGraceHours: 24,
    agentMode: "events",
    monthlyDaysTarget: 8,
  }),
  getUserHoursTarget: vi.fn().mockResolvedValue(5),
  getEffectiveAgentStaleGraceHours: vi.fn().mockResolvedValue(24),
}));

vi.mock("../src/lib/heartbeat-service", () => ({
  getTodaySummary: getTodaySummaryMock,
  getPulseStats: getPulseStatsMock,
}));

vi.mock("../src/lib/out-of-office", () => ({
  isUserOutOfOffice: isUserOutOfOfficeMock,
  buildOutOfOfficeLinkUrl: buildOutOfOfficeLinkUrlMock,
}));

vi.mock("../src/lib/notification-prefs-server", () => ({
  getNotificationPrefs: getNotificationPrefsMock,
}));

vi.mock("../src/lib/compliance-exemptions", () => ({
  getApprovedExemptionsForUser: vi.fn().mockResolvedValue({ monthKeys: [], dayKeys: [] }),
}));

vi.mock("../src/lib/monthly-progress-server", () => ({
  getMonthlyProgress: getMonthlyProgressMock,
}));

import { evaluateUserAlerts } from "../src/lib/integration-alerts";
import { DEFAULT_NOTIFICATION_PREFS } from "../src/lib/notification-prefs";

describe("evaluateUserAlerts in events mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    heartbeatFindManyMock.mockResolvedValue([]);
    activityTickFindFirstMock.mockResolvedValue(null);
    visitFindFirstMock.mockResolvedValue({ id: "visit-1" });
    wasAlertDispatchedTodayMock.mockResolvedValue(false);
    isUserOutOfOfficeMock.mockResolvedValue(false);
    buildOutOfOfficeLinkUrlMock.mockResolvedValue("https://pulse.example/out-of-office");
    getNotificationPrefsMock.mockResolvedValue(DEFAULT_NOTIFICATION_PREFS);
    getTodaySummaryMock.mockResolvedValue({
      dayKey: "2026-09-13",
      totalHours: 0.5,
      laptopActiveHours: 1,
      hoursTarget: 5,
      metTarget: false,
      remainingHours: 4.5,
      inOfficeNow: true,
      visits: [{ id: "visit-1", endAt: null }],
      lastHeartbeat: { ssid: "OfficeConnect", inOffice: true },
      agentHealthy: true,
    });
    getPulseStatsMock.mockResolvedValue({
      agentHealthy: true,
      minutesSinceLastPulse: 2,
    });
    getMonthlyProgressMock.mockResolvedValue({
      monthKey: "2026-09",
      qualifyingDays: 5,
      monthlyDaysTarget: 8,
      remainingDays: 3,
      days: [{ dayKey: "2026-09-13", hours: 0.5, metTarget: false }],
    });
  });

  it("queues hours_started from today's visit without legacy heartbeats", async () => {
    const alerts = await evaluateUserAlerts(
      {
        id: "user-1",
        email: "user@example.com",
        name: "User",
        timezone: "Asia/Kolkata",
        hoursTarget: 5,
        agentStaleGraceHours: null,
      },
      new Set(["hours_started"]),
      new Date("2026-09-13T09:30:00+05:30"),
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.type).toBe("hours_started");
    expect(heartbeatFindManyMock).not.toHaveBeenCalled();
    expect(visitFindFirstMock).toHaveBeenCalled();
  });

  it("queues hours_met from visit totals without legacy heartbeats", async () => {
    getTodaySummaryMock.mockResolvedValue({
      dayKey: "2026-09-13",
      totalHours: 5.2,
      laptopActiveHours: 6,
      hoursTarget: 5,
      metTarget: true,
      remainingHours: 0,
      inOfficeNow: false,
      visits: [{ id: "visit-1", endAt: new Date("2026-09-13T15:00:00+05:30") }],
      lastHeartbeat: { ssid: "OfficeConnect", inOffice: false },
      agentHealthy: true,
    });

    const alerts = await evaluateUserAlerts(
      {
        id: "user-1",
        email: "user@example.com",
        name: "User",
        timezone: "Asia/Kolkata",
        hoursTarget: 5,
        agentStaleGraceHours: null,
      },
      new Set(["hours_met"]),
      new Date("2026-09-13T17:00:00+05:30"),
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.type).toBe("hours_met");
  });

  it("queues a monthly snapshot with dashboard progress while in office", async () => {
    const alerts = await evaluateUserAlerts(
      {
        id: "user-1",
        email: "user@example.com",
        name: "User",
        timezone: "Asia/Kolkata",
        hoursTarget: 5,
        agentStaleGraceHours: null,
      },
      new Set(["monthly_snapshot"]),
      new Date("2026-09-13T09:30:00+05:30"),
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      type: "monthly_snapshot",
      deliveryChannel: "both",
    });
    expect(alerts[0]?.message).toContain("5 of 8 days completed");
    expect(alerts[0]?.message).toContain("you will be at 6 of 8");
  });

  it("still queues hours_started and hours_met while user is marked OOO", async () => {
    isUserOutOfOfficeMock.mockResolvedValue(true);
    getTodaySummaryMock.mockResolvedValue({
      dayKey: "2026-09-13",
      totalHours: 5.2,
      laptopActiveHours: 6,
      hoursTarget: 5,
      metTarget: true,
      remainingHours: 0,
      inOfficeNow: true,
      visits: [{ id: "visit-1", endAt: null }],
      lastHeartbeat: { ssid: "OfficeConnect", inOffice: true },
      agentHealthy: true,
    });

    const alerts = await evaluateUserAlerts(
      {
        id: "user-1",
        email: "user@example.com",
        name: "User",
        timezone: "Asia/Kolkata",
        hoursTarget: 5,
        agentStaleGraceHours: null,
      },
      new Set(["hours_started", "hours_met", "absent"]),
      new Date("2026-09-13T10:00:00+05:30"),
    );

    expect(alerts.map((a) => a.type).sort()).toEqual(["hours_met", "hours_started"]);
  });
});
