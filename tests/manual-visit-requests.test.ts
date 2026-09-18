import { describe, expect, it } from "vitest";
import {
  defaultManualVisitEndAt,
  isValidManualVisitRequestStatus,
  resolveManualVisitEndAt,
  validateManualVisitSubmission,
} from "../src/lib/manual-visit-requests";
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
  it("adds 5 hours when check-out is omitted", () => {
    const startAt = new Date("2026-09-10T09:00:00+05:30");
    expect(defaultManualVisitEndAt(startAt).toISOString()).toBe(
      new Date("2026-09-10T14:00:00+05:30").toISOString(),
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

  it("allows projected check-out at check-in plus 5 hours even if slightly in the future", () => {
    const now = new Date("2026-09-10T10:00:00+05:30");
    const startAt = new Date("2026-09-10T09:00:00+05:30");
    const endAt = defaultManualVisitEndAt(startAt);
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
