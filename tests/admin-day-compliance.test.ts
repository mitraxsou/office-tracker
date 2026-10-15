import { describe, expect, it } from "vitest";
import {
  computeUserDayComplianceRow,
  isAgentStaleForReporting,
  isWeekendDay,
  resolveDayUserStatus,
  summarizeDayCompliance,
  userAttendedOnDay,
  wasAgentStaleAtDayEnd,
  type AdminDayUserRow,
} from "../src/lib/admin-day-compliance";

describe("isWeekendDay", () => {
  it("detects Saturday and Sunday", () => {
    expect(isWeekendDay("2026-09-05")).toBe(true);
    expect(isWeekendDay("2026-09-06")).toBe(true);
    expect(isWeekendDay("2026-09-04")).toBe(false);
    expect(isWeekendDay("2026-09-03")).toBe(false);
  });
});

describe("wasAgentStaleAtDayEnd", () => {
  const dayEnd = new Date("2026-09-04T18:29:59.999+05:30");
  const graceHours = 24;

  it("never marks weekends as stale", () => {
    expect(
      wasAgentStaleAtDayEnd({
        dayKey: "2026-09-06",
        dayEnd: new Date("2026-09-06T18:29:59.999+05:30"),
        lastHeartbeatBeforeDayEnd: null,
        graceHours,
        hadInstalledDevice: true,
      }),
    ).toBe(false);
  });

  it("marks stale when last pulse is older than grace before day end", () => {
    const lastPulse = new Date(dayEnd.getTime() - 30 * 60 * 60 * 1000);
    expect(
      wasAgentStaleAtDayEnd({
        dayKey: "2026-09-04",
        dayEnd,
        lastHeartbeatBeforeDayEnd: lastPulse,
        graceHours,
        hadInstalledDevice: true,
      }),
    ).toBe(true);
  });

  it("is healthy when last pulse is within grace before day end", () => {
    const lastPulse = new Date(dayEnd.getTime() - 5 * 60 * 60 * 1000);
    expect(
      wasAgentStaleAtDayEnd({
        dayKey: "2026-09-04",
        dayEnd,
        lastHeartbeatBeforeDayEnd: lastPulse,
        graceHours,
        hadInstalledDevice: true,
      }),
    ).toBe(false);
  });

  it("does not mark users without installed devices as stale", () => {
    expect(
      wasAgentStaleAtDayEnd({
        dayKey: "2026-09-04",
        dayEnd,
        lastHeartbeatBeforeDayEnd: null,
        graceHours,
        hadInstalledDevice: false,
      }),
    ).toBe(false);
  });
});

describe("userAttendedOnDay", () => {
  const dayStart = new Date("2026-09-04T00:00:00+05:30");
  const dayEnd = new Date("2026-09-04T23:59:59.999+05:30");

  it("attended when hours are logged", () => {
    expect(
      userAttendedOnDay({
        visits: [],
        dayStart,
        dayEnd,
        inOfficeHeartbeats: [],
        totalMs: 3 * 60 * 60 * 1000,
      }),
    ).toBe(true);
  });

  it("does not count pulse-only presence without a Visit", () => {
    expect(
      userAttendedOnDay({
        visits: [],
        dayStart,
        dayEnd,
        inOfficeHeartbeats: [new Date("2026-09-04T10:00:00+05:30")],
        totalMs: 0,
      }),
    ).toBe(false);
  });

  it("attended with overlapping visit segment", () => {
    expect(
      userAttendedOnDay({
        visits: [
          {
            startAt: new Date("2026-09-04T09:00:00+05:30"),
            endAt: new Date("2026-09-04T10:00:00+05:30"),
          },
        ],
        dayStart,
        dayEnd,
        inOfficeHeartbeats: [],
        totalMs: 0,
      }),
    ).toBe(true);
  });

  it("not attended with no activity", () => {
    expect(
      userAttendedOnDay({
        visits: [],
        dayStart,
        dayEnd,
        inOfficeHeartbeats: [],
        totalMs: 0,
      }),
    ).toBe(false);
  });

  it("does not count open visit bleeding into a future day", () => {
    const futureStart = new Date("2026-09-12T00:00:00+05:30");
    const futureEnd = new Date("2026-09-12T23:59:59.999+05:30");
    const now = new Date("2026-09-08T12:00:00+05:30");

    expect(
      userAttendedOnDay({
        visits: [
          {
            startAt: new Date("2026-09-08T09:00:00+05:30"),
            endAt: null,
          },
        ],
        dayStart: futureStart,
        dayEnd: futureEnd,
        inOfficeHeartbeats: [],
        totalMs: 0,
        now,
      }),
    ).toBe(false);
  });

  it("does not count open visit bleeding into a weekend without activity", () => {
    const saturdayStart = new Date("2026-09-06T00:00:00+05:30");
    const saturdayEnd = new Date("2026-09-06T23:59:59.999+05:30");
    const now = new Date("2026-09-08T12:00:00+05:30");

    expect(
      userAttendedOnDay({
        visits: [
          {
            startAt: new Date("2026-09-05T09:00:00+05:30"),
            endAt: null,
          },
        ],
        dayStart: saturdayStart,
        dayEnd: saturdayEnd,
        inOfficeHeartbeats: [],
        totalMs: 0,
        now,
      }),
    ).toBe(false);
  });

  it("counts open visit on the current day", () => {
    const now = new Date("2026-09-08T12:00:00+05:30");
    const dayStart = new Date("2026-09-08T00:00:00+05:30");
    const dayEnd = new Date("2026-09-08T23:59:59.999+05:30");

    expect(
      userAttendedOnDay({
        visits: [
          {
            startAt: new Date("2026-09-08T09:00:00+05:30"),
            endAt: null,
          },
        ],
        dayStart,
        dayEnd,
        inOfficeHeartbeats: [],
        totalMs: 0,
        now,
      }),
    ).toBe(true);
  });

  it("counts open visit on a past day when there was in-office activity that day", () => {
    const now = new Date("2026-09-08T12:00:00+05:30");
    const dayStart = new Date("2026-09-03T00:00:00+05:30");
    const dayEnd = new Date("2026-09-03T23:59:59.999+05:30");

    expect(
      userAttendedOnDay({
        visits: [
          {
            startAt: new Date("2026-09-01T09:00:00+05:30"),
            endAt: null,
          },
        ],
        dayStart,
        dayEnd,
        inOfficeHeartbeats: [new Date("2026-09-03T10:00:00+05:30")],
        totalMs: 0,
        now,
      }),
    ).toBe(true);
  });

  it("does not count ghost zero-span closed visits as attended", () => {
    expect(
      userAttendedOnDay({
        visits: [
          {
            startAt: new Date("2026-09-04T14:37:00+05:30"),
            endAt: new Date("2026-09-04T14:37:00+05:30"),
          },
        ],
        dayStart,
        dayEnd,
        inOfficeHeartbeats: [],
        totalMs: 0,
      }),
    ).toBe(false);
  });
});

describe("resolveDayUserStatus", () => {
  it("counts OOO user with office hours as attended", () => {
    expect(
      resolveDayUserStatus({
        ooo: true,
        agentStaleOnDay: false,
        attended: true,
        metTarget: true,
      }),
    ).toBe("attended_met");
    expect(
      resolveDayUserStatus({
        ooo: true,
        agentStaleOnDay: false,
        attended: true,
        metTarget: false,
      }),
    ).toBe("attended_not_met");
  });

  it("excludes OOO user with no office activity", () => {
    expect(
      resolveDayUserStatus({
        ooo: true,
        agentStaleOnDay: false,
        attended: false,
        metTarget: false,
      }),
    ).toBe("excluded_ooo");
  });

  it("stale agent takes precedence over OOO when there is no attendance", () => {
    expect(
      resolveDayUserStatus({
        ooo: true,
        agentStaleOnDay: true,
        attended: false,
        metTarget: false,
      }),
    ).toBe("excluded_stale");
  });

  it("office presence overrides stale-agent exclusion", () => {
    expect(
      resolveDayUserStatus({
        ooo: false,
        agentStaleOnDay: true,
        attended: true,
        metTarget: true,
      }),
    ).toBe("attended_met");
    expect(
      resolveDayUserStatus({
        ooo: false,
        agentStaleOnDay: true,
        attended: true,
        metTarget: false,
      }),
    ).toBe("attended_not_met");
  });
});

describe("summarizeDayCompliance", () => {
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
      firstInAt: null,
      lastOutAt: null,
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
      firstInAt: null,
      lastOutAt: null,
    },
    {
      userId: "3",
      email: "c@example.com",
      name: null,
      hours: 0,
      hoursTarget: 5,
      metTarget: false,
      attended: false,
      status: "no_visit",
      agentHealthy: true,
      agentStaleOnDay: false,
      firstInAt: null,
      lastOutAt: null,
    },
    {
      userId: "4",
      email: "d@example.com",
      name: null,
      hours: 0,
      hoursTarget: 5,
      metTarget: false,
      attended: false,
      status: "excluded_ooo",
      agentHealthy: true,
      agentStaleOnDay: false,
      firstInAt: null,
      lastOutAt: null,
    },
    {
      userId: "5",
      email: "e@example.com",
      name: null,
      hours: 4,
      hoursTarget: 5,
      metTarget: false,
      attended: false,
      status: "excluded_stale",
      agentHealthy: false,
      agentStaleOnDay: true,
      firstInAt: null,
      lastOutAt: null,
    },
  ];

  it("uses attended-only denominator for compliance", () => {
    const summary = summarizeDayCompliance(rows);
    expect(summary.totalUsers).toBe(5);
    expect(summary.attendedCount).toBe(2);
    expect(summary.metTargetCount).toBe(1);
    expect(summary.compliancePct).toBe(50);
    expect(summary.excludedOoo).toBe(1);
    expect(summary.excludedStale).toBe(1);
    expect(summary.excludedNoVisit).toBe(1);
  });
});

describe("isAgentStaleForReporting", () => {
  it("suppresses stale reporting on weekends", () => {
    expect(isAgentStaleForReporting("2026-09-06", true)).toBe(false);
    expect(isAgentStaleForReporting("2026-09-04", true)).toBe(true);
    expect(isAgentStaleForReporting("2026-09-04", false)).toBe(false);
  });
});

describe("Admin day In/Out aligns with Today day-span staleMs", () => {
  const user = {
    id: "soumitra",
    email: "soumitra.m.mandal@pwc.com",
    name: "soumitro",
    timezone: "Asia/Kolkata",
    hoursTarget: 5,
    agentStaleGraceHours: 24,
    agentDeregisteredAt: null,
  };
  const dayKey = "2026-10-15";
  const now = new Date("2026-10-15T15:20:00+05:30");
  const afternoonIn = new Date("2026-10-15T13:35:00+05:30");
  const earlyPulse = new Date("2026-10-15T00:52:00+05:30");
  const agentStaleMs = 15 * 60 * 1000;
  const graceAsStaleMs = 24 * 60 * 60 * 1000;
  const baseInput = {
    user,
    dayKey,
    hadInstalledDevice: true,
    lastHeartbeatBeforeDayEnd: now,
    ooo: false,
    useActivity: false,
    officeSsids: ["OfficeConnect"],
    hoursTarget: 5,
    graceHours: 24,
    now,
  } as const;

  it("does not pull firstIn back to a 12:52am pulse when using agentStaleMinutes", () => {
    const visits = [
      {
        id: "afternoon",
        source: "wifi",
        ssid: "OfficeConnect",
        startAt: afternoonIn,
        endAt: null,
        updatedAt: afternoonIn,
      },
    ];
    const dayPulses = [
      { at: earlyPulse, ssid: "OfficeConnect", inOffice: true },
      { at: afternoonIn, ssid: "OfficeConnect", inOffice: true },
    ];

    // Bug: Admin used graceHours (~24h) as staleMs, so firstIn snapped to midnight pulse.
    const broken = computeUserDayComplianceRow({
      ...baseInput,
      visits,
      dayPulses,
      staleMs: graceAsStaleMs,
    });
    expect(new Date(broken.firstInAt!).getTime()).toBe(earlyPulse.getTime());
    expect(broken.hours).toBeGreaterThan(12);

    const fixed = computeUserDayComplianceRow({
      ...baseInput,
      visits,
      dayPulses,
      staleMs: agentStaleMs,
    });
    expect(new Date(fixed.firstInAt!).getTime()).toBe(afternoonIn.getTime());
    expect(fixed.hours).toBeLessThan(3);
    expect(fixed.lastOutAt).toBeNull();
  });

  it("after overnight EOD close, only today's open visit remains for firstIn/lastOut", () => {
    // Production filters with visitsOverlappingDay — prior-day closed visits are gone.
    const row = computeUserDayComplianceRow({
      ...baseInput,
      visits: [
        {
          id: "afternoon",
          source: "wifi",
          ssid: "OfficeConnect",
          startAt: afternoonIn,
          endAt: null,
          updatedAt: afternoonIn,
        },
      ],
      dayPulses: [
        { at: earlyPulse, ssid: "OfficeConnect", inOffice: true },
        { at: afternoonIn, ssid: "OfficeConnect", inOffice: true },
      ],
      staleMs: agentStaleMs,
    });

    expect(new Date(row.firstInAt!).getTime()).toBe(afternoonIn.getTime());
    expect(row.hours).toBeLessThan(3);
    expect(row.lastOutAt).toBeNull();
    expect(row.attended).toBe(true);
  });

  it("keeps lastOut null while an open visit is on the current day", () => {
    const row = computeUserDayComplianceRow({
      ...baseInput,
      visits: [
        {
          id: "closed",
          source: "wifi",
          ssid: "OfficeConnect",
          startAt: new Date("2026-10-15T12:41:00+05:30"),
          endAt: new Date("2026-10-15T13:42:00+05:30"),
        },
        {
          id: "open",
          source: "wifi",
          ssid: "OfficeConnect",
          startAt: afternoonIn,
          endAt: null,
        },
      ],
      dayPulses: [{ at: afternoonIn, ssid: "OfficeConnect", inOffice: true }],
      staleMs: agentStaleMs,
    });

    expect(row.lastOutAt).toBeNull();
    expect(new Date(row.firstInAt!).getTime()).toBe(
      new Date("2026-10-15T12:41:00+05:30").getTime(),
    );
  });
});
