import { describe, expect, it } from "vitest";
import {
  computeUserDayComplianceRow,
  summarizeDayCompliance,
  toAdminOrgCalendarDay,
  type AdminDayUserRow,
} from "../src/lib/admin-day-compliance";

describe("toAdminOrgCalendarDay", () => {
  it("maps compliance summary to calendar day fields", () => {
    const rows: AdminDayUserRow[] = [
      {
        userId: "1",
        email: "a@example.com",
        name: null,
        hours: 6,
        hoursTarget: 5,
        metTarget: true,
        attended: true,
        status: "attended_met",
        agentHealthy: true,
        agentStaleOnDay: false,
      },
      {
        userId: "2",
        email: "b@example.com",
        name: null,
        hours: 3,
        hoursTarget: 5,
        metTarget: false,
        attended: true,
        status: "attended_not_met",
        agentHealthy: true,
        agentStaleOnDay: false,
      },
      {
        userId: "3",
        email: "c@example.com",
        name: null,
        hours: 0,
        hoursTarget: 5,
        metTarget: false,
        attended: false,
        status: "excluded_ooo",
        agentHealthy: true,
        agentStaleOnDay: false,
      },
    ];

    const summary = summarizeDayCompliance(rows);
    const day = toAdminOrgCalendarDay("2026-09-04", summary, 9);

    expect(day.dayKey).toBe("2026-09-04");
    expect(day.totalRegistered).toBe(3);
    expect(day.attendedCount).toBe(2);
    expect(day.metTargetCount).toBe(1);
    expect(day.compliancePct).toBe(50);
    expect(day.excludedOoo).toBe(1);
    expect(day.totalAttendedHours).toBe(9);
    expect(day.isWeekend).toBe(false);
  });
});

describe("computeUserDayComplianceRow OOO override", () => {
  const user = {
    id: "u1",
    email: "user@example.com",
    name: null,
    timezone: "Asia/Kolkata",
    hoursTarget: 5,
    agentStaleGraceHours: 24,
    agentDeregisteredAt: null,
  };

  it("counts OOO user with logged hours as attended", () => {
    const row = computeUserDayComplianceRow({
      user,
      dayKey: "2026-09-04",
      hadInstalledDevice: true,
      lastHeartbeatBeforeDayEnd: new Date("2026-09-04T18:00:00+05:30"),
      ooo: true,
      visits: [
        {
          id: "v1",
          source: "auto",
          ssid: "OfficeConnect",
          startAt: new Date("2026-09-04T09:00:00+05:30"),
          endAt: new Date("2026-09-04T16:00:00+05:30"),
        },
      ],
      dayHeartbeats: [],
      officeSsids: ["OfficeConnect"],
      hoursTarget: 5,
      graceHours: 24,
    });

    expect(row.attended).toBe(true);
    expect(row.status).toBe("attended_met");
    expect(row.metTarget).toBe(true);
  });

  it("excludes stale agent without office activity on weekdays", () => {
    const row = computeUserDayComplianceRow({
      user,
      dayKey: "2026-09-04",
      hadInstalledDevice: true,
      lastHeartbeatBeforeDayEnd: null,
      ooo: false,
      visits: [],
      dayHeartbeats: [],
      officeSsids: ["OfficeConnect"],
      hoursTarget: 5,
      graceHours: 24,
    });

    expect(row.attended).toBe(false);
    expect(row.status).toBe("excluded_stale");
  });

  it("does not penalize stale agents on weekends", () => {
    const row = computeUserDayComplianceRow({
      user,
      dayKey: "2026-09-06",
      hadInstalledDevice: true,
      lastHeartbeatBeforeDayEnd: null,
      ooo: false,
      visits: [],
      dayHeartbeats: [],
      officeSsids: ["OfficeConnect"],
      hoursTarget: 5,
      graceHours: 24,
    });

    expect(row.status).toBe("no_visit");
    expect(row.agentStaleOnDay).toBe(false);
  });

  it("does not mark attended on a future day from an open visit", () => {
    const row = computeUserDayComplianceRow({
      user,
      dayKey: "2026-09-12",
      hadInstalledDevice: true,
      lastHeartbeatBeforeDayEnd: new Date("2026-09-08T18:00:00+05:30"),
      ooo: false,
      visits: [
        {
          id: "v1",
          source: "wifi",
          ssid: "OfficeConnect",
          startAt: new Date("2026-09-08T09:00:00+05:30"),
          endAt: null,
        },
      ],
      dayHeartbeats: [],
      officeSsids: ["OfficeConnect"],
      hoursTarget: 5,
      graceHours: 24,
      now: new Date("2026-09-08T12:00:00+05:30"),
    });

    expect(row.attended).toBe(false);
    expect(row.hours).toBe(0);
    expect(row.status).toBe("no_visit");
  });
});

describe("org calendar day aggregation", () => {
  it("builds green, orange, and gray day tones from attended counts", () => {
    const green = toAdminOrgCalendarDay(
      "2026-09-03",
      {
        totalUsers: 5,
        attendedCount: 3,
        metTargetCount: 3,
        compliancePct: 100,
        excludedStale: 1,
        excludedOoo: 1,
        excludedNoVisit: 0,
      },
      18,
    );
    const orange = toAdminOrgCalendarDay(
      "2026-09-04",
      {
        totalUsers: 5,
        attendedCount: 2,
        metTargetCount: 1,
        compliancePct: 50,
        excludedStale: 1,
        excludedOoo: 1,
        excludedNoVisit: 1,
      },
      8,
    );
    const gray = toAdminOrgCalendarDay(
      "2026-09-05",
      {
        totalUsers: 5,
        attendedCount: 0,
        metTargetCount: 0,
        compliancePct: 0,
        excludedStale: 2,
        excludedOoo: 1,
        excludedNoVisit: 2,
      },
      0,
    );

    expect(green.metTargetCount).toBe(green.attendedCount);
    expect(orange.metTargetCount).toBeLessThan(orange.attendedCount);
    expect(gray.attendedCount).toBe(0);
  });
});
