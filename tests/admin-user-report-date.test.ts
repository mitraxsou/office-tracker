import { describe, expect, it } from "vitest";
import {
  buildAdminUserReportHref,
  isValidDayKey,
  lastDayKeyOfMonth,
  monthKeyFromDayKey,
  parseAdminUserReportQuery,
  resolveDefaultSelectedDate,
  shiftDayKey,
  summarizeSelectedDay,
} from "../src/lib/admin-user-report-date";

describe("isValidDayKey", () => {
  it("accepts real calendar days", () => {
    expect(isValidDayKey("2026-09-18")).toBe(true);
    expect(isValidDayKey("2024-02-29")).toBe(true);
  });

  it("rejects invalid shapes and impossible dates", () => {
    expect(isValidDayKey(null)).toBe(false);
    expect(isValidDayKey("2026-9-18")).toBe(false);
    expect(isValidDayKey("2026-02-30")).toBe(false);
    expect(isValidDayKey("not-a-date")).toBe(false);
  });
});

describe("resolveDefaultSelectedDate", () => {
  const timezone = "Asia/Kolkata";

  it("prefers an explicit date in the viewed month", () => {
    expect(
      resolveDefaultSelectedDate({
        monthKey: "2026-09",
        timezone,
        dailyTrend: [{ date: "2026-09-10", totalHours: 6 }],
        preferredDate: "2026-09-05",
        now: new Date("2026-09-18T10:00:00+05:30"),
      }),
    ).toBe("2026-09-05");
  });

  it("defaults to today when viewing the current month", () => {
    expect(
      resolveDefaultSelectedDate({
        monthKey: "2026-09",
        timezone,
        dailyTrend: [],
        preferredDate: null,
        now: new Date("2026-09-18T10:00:00+05:30"),
      }),
    ).toBe("2026-09-18");
  });

  it("ignores preferred dates outside the month and picks latest office day", () => {
    expect(
      resolveDefaultSelectedDate({
        monthKey: "2026-08",
        timezone,
        dailyTrend: [
          { date: "2026-08-04", totalHours: 5 },
          { date: "2026-08-12", totalHours: 7 },
          { date: "2026-08-20", totalHours: 0 },
        ],
        preferredDate: "2026-09-18",
        now: new Date("2026-09-18T10:00:00+05:30"),
      }),
    ).toBe("2026-08-12");
  });

  it("falls back to the last calendar day when the month has no hours", () => {
    expect(
      resolveDefaultSelectedDate({
        monthKey: "2026-08",
        timezone,
        dailyTrend: [],
        preferredDate: null,
        now: new Date("2026-09-18T10:00:00+05:30"),
      }),
    ).toBe(lastDayKeyOfMonth("2026-08"));
  });
});

describe("buildAdminUserReportHref and parseAdminUserReportQuery", () => {
  it("builds hrefs that retain month and date", () => {
    expect(buildAdminUserReportHref("user-1")).toBe("/admin/reports/users/user-1");
    expect(
      buildAdminUserReportHref("user-1", { month: "2026-09", date: "2026-09-18" }),
    ).toBe("/admin/reports/users/user-1?month=2026-09&date=2026-09-18");
  });

  it("parses valid query params and drops invalid ones", () => {
    expect(
      parseAdminUserReportQuery(
        new URLSearchParams("month=2026-09&date=2026-09-18"),
      ),
    ).toEqual({ month: "2026-09", date: "2026-09-18" });
    expect(
      parseAdminUserReportQuery(new URLSearchParams("month=bad&date=nope")),
    ).toEqual({ month: null, date: null });
  });
});

describe("summarizeSelectedDay", () => {
  it("filters visits for the day and reports open visit state", () => {
    const summary = summarizeSelectedDay({
      dayKey: "2026-09-18",
      timezone: "Asia/Kolkata",
      hoursTarget: 5,
      dailyTrend: [{ date: "2026-09-18", totalHours: 6.5, metTarget: true }],
      visits: [
        {
          id: "v1",
          startAt: "2026-09-18T03:30:00.000Z",
          endAt: "2026-09-18T08:00:00.000Z",
          source: "wifi",
          ssid: "OfficeConnect",
        },
        {
          id: "v2",
          startAt: "2026-09-18T09:00:00.000Z",
          endAt: null,
          source: "manual",
          ssid: null,
        },
        {
          id: "v3",
          startAt: "2026-09-17T04:00:00.000Z",
          endAt: "2026-09-17T10:00:00.000Z",
          source: "wifi",
          ssid: "OfficeConnect",
        },
      ],
    });

    expect(summary.visitCount).toBe(2);
    expect(summary.metTarget).toBe(true);
    expect(summary.totalHours).toBe(6.5);
    expect(summary.openVisit).toBe(true);
    expect(summary.visits.map((v) => v.id)).toEqual(["v1", "v2"]);
  });

  it("marks empty days below target", () => {
    const summary = summarizeSelectedDay({
      dayKey: "2026-09-01",
      timezone: "Asia/Kolkata",
      hoursTarget: 5,
      dailyTrend: [],
      visits: [],
    });
    expect(summary.visitCount).toBe(0);
    expect(summary.metTarget).toBe(false);
    expect(summary.totalHours).toBe(0);
  });
});

describe("day navigation helpers", () => {
  it("shifts day keys and extracts month keys", () => {
    expect(shiftDayKey("2026-09-01", -1)).toBe("2026-08-31");
    expect(shiftDayKey("2026-09-30", 1)).toBe("2026-10-01");
    expect(monthKeyFromDayKey("2026-09-18")).toBe("2026-09");
  });
});
