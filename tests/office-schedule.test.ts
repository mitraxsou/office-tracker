import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  AUTO_FILL_GRACE_MINUTES,
  canApplyInferredSchedule,
  inferOfficeSchedule,
  inferredScheduleEqualsPrefs,
  isoWeekdayFromDayKey,
  minutesToHhMm,
  type OfficeDaySample,
} from "../src/lib/office-schedule";
import { authorizeCronRequest } from "../src/lib/cron-auth";

const WINDOW_START = "2026-01-05"; // Monday
const WINDOW_END = "2026-03-01"; // Sunday (56 days, 8 of each weekday)

function sample(dayKey: string, firstInMinutes: number, lastOutMinutes: number | null): OfficeDaySample {
  return { dayKey, firstInMinutes, lastOutMinutes };
}

describe("office schedule inference", () => {
  it("does not auto-overwrite grace", () => {
    expect(AUTO_FILL_GRACE_MINUTES).toBe(false);
  });

  it("maps day keys to ISO weekdays", () => {
    expect(isoWeekdayFromDayKey("2026-01-05")).toBe(1);
    expect(isoWeekdayFromDayKey("2026-01-11")).toBe(7);
  });

  it("rounds times to the nearest 15 minutes", () => {
    expect(minutesToHhMm(9 * 60 + 7)).toBe("09:00");
    expect(minutesToHhMm(9 * 60 + 8)).toBe("09:15");
  });

  it("skips the user when no weekday has enough office days", () => {
    const inferred = inferOfficeSchedule({
      samples: [
        sample("2026-01-05", 9 * 60 + 30, 18 * 60),
        sample("2026-01-12", 9 * 60 + 30, 18 * 60),
      ],
      windowStartDayKey: WINDOW_START,
      windowEndDayKey: WINDOW_END,
    });
    expect(inferred).toBeNull();
  });

  it("includes a weekday with at least 3 qualifying days", () => {
    const inferred = inferOfficeSchedule({
      samples: [
        sample("2026-01-05", 9 * 60, 18 * 60),
        sample("2026-01-12", 9 * 60 + 30, 18 * 60),
        sample("2026-01-19", 10 * 60, 18 * 60),
      ],
      windowStartDayKey: WINDOW_START,
      windowEndDayKey: WINDOW_END,
    });
    expect(inferred?.workDays).toEqual([1]);
    expect(inferred?.officeStartTime).toBe("09:30");
    expect(inferred?.officeEndTime).toBe("18:00");
  });

  it("includes a weekday at 40% of calendar occurrences even if under 3 days", () => {
    const inferred = inferOfficeSchedule({
      samples: [
        sample("2026-01-06", 8 * 60 + 45, 17 * 60),
        sample("2026-01-13", 8 * 60 + 45, 17 * 60),
      ],
      windowStartDayKey: "2026-01-05",
      windowEndDayKey: "2026-02-08",
    });
    expect(inferred?.workDays).toEqual([2]);
    expect(inferred?.officeStartTime).toBe("08:45");
    expect(inferred?.officeEndTime).toBe("17:00");
  });

  it("uses median last-out and skips end when many visits are still open", () => {
    const withEnds = inferOfficeSchedule({
      samples: [
        sample("2026-01-05", 9 * 60, 17 * 60 + 50),
        sample("2026-01-12", 9 * 60, 18 * 60 + 10),
        sample("2026-01-19", 9 * 60, 18 * 60),
      ],
      windowStartDayKey: WINDOW_START,
      windowEndDayKey: WINDOW_END,
    });
    expect(withEnds?.officeEndTime).toBe("18:00");

    const manyOpen = inferOfficeSchedule({
      samples: [
        sample("2026-01-05", 9 * 60, null),
        sample("2026-01-12", 9 * 60, null),
        sample("2026-01-19", 9 * 60, 18 * 60),
      ],
      windowStartDayKey: WINDOW_START,
      windowEndDayKey: WINDOW_END,
    });
    expect(manyOpen?.officeStartTime).toBe("09:00");
    expect(manyOpen?.officeEndTime).toBeNull();
  });
});

describe("auto-fill protection", () => {
  const defaults = {
    workDays: [3, 5],
    officeStartTime: "09:30",
    officeEndTime: "18:00",
  };

  it("fills default and previously auto-filled rows", () => {
    expect(
      canApplyInferredSchedule({ ...defaults, scheduleUserSet: false, scheduleAutoFilled: false }),
    ).toBe(true);
    expect(
      canApplyInferredSchedule({
        workDays: [1, 3],
        officeStartTime: "10:00",
        officeEndTime: "19:00",
        scheduleUserSet: false,
        scheduleAutoFilled: true,
      }),
    ).toBe(true);
  });

  it("does not clobber user-set or legacy custom schedules", () => {
    expect(
      canApplyInferredSchedule({ ...defaults, scheduleUserSet: true, scheduleAutoFilled: false }),
    ).toBe(false);
    expect(
      canApplyInferredSchedule({
        workDays: [1, 2, 3],
        officeStartTime: "10:00",
        officeEndTime: "18:00",
        scheduleUserSet: false,
        scheduleAutoFilled: false,
      }),
    ).toBe(false);
  });

  it("treats a matching inference as not a suggestion", () => {
    expect(
      inferredScheduleEqualsPrefs(
        { workDays: [3, 5], officeStartTime: "09:30", officeEndTime: "18:00" },
        defaults,
      ),
    ).toBe(true);
  });
});

describe("cron auth guard", () => {
  const previous = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  });

  it("rejects missing or wrong bearer tokens", () => {
    const unauthorized = authorizeCronRequest(new Request("https://example.local/api/cron/office-schedule"));
    expect(unauthorized).toEqual({ ok: false, status: 401, error: "Unauthorized" });

    const wrong = authorizeCronRequest(
      new Request("https://example.local/api/cron/office-schedule", {
        headers: { authorization: "Bearer other" },
      }),
    );
    expect(wrong.ok).toBe(false);
  });

  it("accepts the configured bearer secret", () => {
    const ok = authorizeCronRequest(
      new Request("https://example.local/api/cron/office-schedule", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );
    expect(ok).toEqual({ ok: true });
  });

  it("returns 503 when CRON_SECRET is missing", () => {
    delete process.env.CRON_SECRET;
    const result = authorizeCronRequest(
      new Request("https://example.local/api/cron/office-schedule", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );
    expect(result).toEqual({ ok: false, status: 503, error: "CRON_SECRET not configured" });
  });
});
