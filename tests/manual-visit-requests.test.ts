import { describe, expect, it } from "vitest";
import { DEFAULT_HOURS_TARGET, DEFAULT_MANUAL_VISIT_DURATION_MINUTES } from "../src/lib/constants";
import {
  buildMarkDayVisitedWindow,
  defaultManualVisitEndAt,
  DEFAULT_MARK_DAY_START_TIME,
  isValidManualVisitRequestStatus,
  planMarkDaysVisitedRequests,
  resolveManualVisitEndAt,
  validateManualVisitSubmission,
} from "../src/lib/manual-visit-requests";
import { dayKeyInTimezone } from "../src/lib/timezone-dates";
import { CLOCK_SKEW_GRACE_MS } from "../src/lib/visit-validation";

describe("isValidManualVisitRequestStatus", () => {
  it("accepts open, approved, rejected", () => {
    expect(isValidManualVisitRequestStatus("open")).toBe(true);
    expect(isValidManualVisitRequestStatus("approved")).toBe(true);
    expect(isValidManualVisitRequestStatus("rejected")).toBe(true);
  });

  it("rejects unknown statuses", () => {
    expect(isValidManualVisitRequestStatus("pending")).toBe(false);
    expect(isValidManualVisitRequestStatus("")).toBe(false);
  });
});

describe("defaultManualVisitEndAt", () => {
  it("adds 5 minutes when check-out is omitted", () => {
    expect(DEFAULT_MANUAL_VISIT_DURATION_MINUTES).toBe(5);
    const startAt = new Date("2026-09-10T09:00:00+05:30");
    expect(defaultManualVisitEndAt(startAt).toISOString()).toBe(
      new Date("2026-09-10T09:05:00+05:30").toISOString(),
    );
  });

  it("never leaves the visit open when check-out is omitted", () => {
    const startAt = new Date("2026-09-10T09:00:00+05:30");
    const endAt = resolveManualVisitEndAt(startAt, null);
    expect(endAt).not.toBeNull();
    expect(endAt.getTime()).toBeGreaterThan(startAt.getTime());
    expect(endAt.getTime() - startAt.getTime()).toBe(
      DEFAULT_MANUAL_VISIT_DURATION_MINUTES * 60 * 1000,
    );
  });

  it("resolveManualVisitEndAt keeps an explicit check-out", () => {
    const startAt = new Date("2026-09-10T09:00:00+05:30");
    const endAt = new Date("2026-09-10T17:00:00+05:30");
    expect(resolveManualVisitEndAt(startAt, endAt)).toEqual(endAt);
    expect(resolveManualVisitEndAt(startAt, null).toISOString()).toBe(
      defaultManualVisitEndAt(startAt).toISOString(),
    );
  });
});

describe("validateManualVisitSubmission", () => {
  it("rejects endAt before or equal to startAt", () => {
    const startAt = new Date("2026-09-10T09:00:00+05:30");
    const endAt = new Date("2026-09-10T08:00:00+05:30");
    expect(
      validateManualVisitSubmission({
        startAt,
        endAt,
        hasDuplicateOpen: false,
      }),
    ).toBe("Check-out must be after check-in");
  });

  it("rejects missing check-out", () => {
    const startAt = new Date("2026-09-10T09:00:00+05:30");
    expect(
      validateManualVisitSubmission({
        startAt,
        endAt: null,
        hasDuplicateOpen: false,
      }),
    ).toBe("Check-out is required");
  });

  it("rejects future check-in beyond clock skew grace", () => {
    const startAt = new Date(Date.now() + CLOCK_SKEW_GRACE_MS + 60_000);
    expect(
      validateManualVisitSubmission({
        startAt,
        endAt: defaultManualVisitEndAt(startAt),
        hasDuplicateOpen: false,
      }),
    ).toBe("Check-in time cannot be in the future");
  });

  it("allows projected check-out at check-in plus 5 minutes even if slightly in the future", () => {
    const now = new Date("2026-09-10T09:02:00+05:30");
    const startAt = new Date("2026-09-10T09:00:00+05:30");
    const endAt = defaultManualVisitEndAt(startAt);
    expect(endAt.toISOString()).toBe(new Date("2026-09-10T09:05:00+05:30").toISOString());
    expect(
      validateManualVisitSubmission({
        startAt,
        endAt,
        hasDuplicateOpen: false,
        now,
      }),
    ).toBeNull();
  });

  it("rejects duplicate open request for same startAt", () => {
    const startAt = new Date("2026-09-10T09:00:00+05:30");
    expect(
      validateManualVisitSubmission({
        startAt,
        endAt: defaultManualVisitEndAt(startAt),
        hasDuplicateOpen: true,
      }),
    ).toBe("You already have a pending manual visit request for this check-in time");
  });

  it("allows valid submission", () => {
    const startAt = new Date("2026-09-10T09:00:00+05:30");
    const endAt = new Date("2026-09-10T17:00:00+05:30");
    expect(
      validateManualVisitSubmission({
        startAt,
        endAt,
        hasDuplicateOpen: false,
      }),
    ).toBeNull();
  });
});

describe("buildMarkDayVisitedWindow", () => {
  it("creates a same-day visit whose duration equals hoursTarget", () => {
    const hoursTarget = 5;
    const window = buildMarkDayVisitedWindow({
      dayKey: "2026-09-10",
      timezone: "Asia/Kolkata",
      hoursTarget,
      officeStartTime: "09:30",
    });

    expect(window.startAt.toISOString()).toBe(new Date("2026-09-10T09:30:00+05:30").toISOString());
    expect(window.endAt.toISOString()).toBe(new Date("2026-09-10T14:30:00+05:30").toISOString());
    expect(window.durationMs).toBe(hoursTarget * 60 * 60 * 1000);
    expect(dayKeyInTimezone(window.startAt, "Asia/Kolkata")).toBe("2026-09-10");
    expect(dayKeyInTimezone(window.endAt, "Asia/Kolkata")).toBe("2026-09-10");
  });

  it("defaults start to 09:30 and duration to DEFAULT_HOURS_TARGET", () => {
    expect(DEFAULT_MARK_DAY_START_TIME).toBe("09:30");
    const window = buildMarkDayVisitedWindow({
      dayKey: "2026-09-10",
      timezone: "Asia/Kolkata",
      hoursTarget: DEFAULT_HOURS_TARGET,
    });
    expect(window.startAt.toISOString()).toBe(new Date("2026-09-10T09:30:00+05:30").toISOString());
    expect(window.durationMs).toBe(DEFAULT_HOURS_TARGET * 60 * 60 * 1000);
  });

  it("uses the user's officeStartTime preference when provided", () => {
    const window = buildMarkDayVisitedWindow({
      dayKey: "2026-09-10",
      timezone: "Asia/Kolkata",
      hoursTarget: 5,
      officeStartTime: "10:00",
    });
    expect(window.startAt.toISOString()).toBe(new Date("2026-09-10T10:00:00+05:30").toISOString());
    expect(window.endAt.toISOString()).toBe(new Date("2026-09-10T15:00:00+05:30").toISOString());
  });

  it("shifts start earlier when preferred start + target would cross midnight", () => {
    const window = buildMarkDayVisitedWindow({
      dayKey: "2026-09-10",
      timezone: "Asia/Kolkata",
      hoursTarget: 5,
      officeStartTime: "22:00",
    });
    expect(dayKeyInTimezone(window.startAt, "Asia/Kolkata")).toBe("2026-09-10");
    expect(dayKeyInTimezone(window.endAt, "Asia/Kolkata")).toBe("2026-09-10");
    expect(window.durationMs).toBe(5 * 60 * 60 * 1000);
    expect(window.endAt.getTime()).toBeGreaterThan(window.startAt.getTime());
  });
});

describe("planMarkDaysVisitedRequests", () => {
  it("expands multiple calendar days into N request windows", () => {
    const { plans, error } = planMarkDaysVisitedRequests({
      dayKeys: ["2026-09-12", "2026-09-10", "2026-09-11"],
      timezone: "Asia/Kolkata",
      hoursTarget: 5,
      officeStartTime: "09:30",
      now: new Date("2026-09-15T12:00:00+05:30"),
    });

    expect(error).toBeUndefined();
    expect(plans).toHaveLength(3);
    expect(plans.map((p) => p.dayKey)).toEqual(["2026-09-10", "2026-09-11", "2026-09-12"]);
    for (const plan of plans) {
      expect(plan.durationMs).toBe(5 * 60 * 60 * 1000);
      expect(dayKeyInTimezone(plan.startAt, "Asia/Kolkata")).toBe(plan.dayKey);
      expect(dayKeyInTimezone(plan.endAt, "Asia/Kolkata")).toBe(plan.dayKey);
    }
  });

  it("deduplicates day keys", () => {
    const { plans, error } = planMarkDaysVisitedRequests({
      dayKeys: ["2026-09-10", "2026-09-10", "2026-09-11"],
      timezone: "Asia/Kolkata",
      hoursTarget: 5,
      now: new Date("2026-09-15T12:00:00+05:30"),
    });
    expect(error).toBeUndefined();
    expect(plans).toHaveLength(2);
  });

  it("rejects empty selection and future days", () => {
    expect(
      planMarkDaysVisitedRequests({
        dayKeys: [],
        timezone: "Asia/Kolkata",
        hoursTarget: 5,
        now: new Date("2026-09-15T12:00:00+05:30"),
      }).error,
    ).toBe("Select at least one day");

    expect(
      planMarkDaysVisitedRequests({
        dayKeys: ["2026-09-20"],
        timezone: "Asia/Kolkata",
        hoursTarget: 5,
        now: new Date("2026-09-15T12:00:00+05:30"),
      }).error,
    ).toBe("Cannot mark future days as visited");
  });
});
