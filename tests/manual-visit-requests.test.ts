import { describe, expect, it } from "vitest";
import {
  isValidManualVisitRequestStatus,
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

  it("rejects future check-in beyond clock skew grace", () => {
    const startAt = new Date(Date.now() + CLOCK_SKEW_GRACE_MS + 60_000);
    expect(
      validateManualVisitSubmission({
        startAt,
        endAt: null,
        hasDuplicateOpen: false,
      }),
    ).toBe("Check-in time cannot be in the future");
  });

  it("rejects duplicate open request for same startAt", () => {
    const startAt = new Date("2026-09-10T09:00:00+05:30");
    expect(
      validateManualVisitSubmission({
        startAt,
        endAt: null,
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
