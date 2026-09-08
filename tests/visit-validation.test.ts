import { describe, expect, it } from "vitest";
import { CLOCK_SKEW_GRACE_MS, validateVisitTimestamps } from "../src/lib/visit-validation";

describe("validateVisitTimestamps", () => {
  const now = new Date("2026-09-08T12:00:00+05:30");

  it("accepts start and end within clock skew grace", () => {
    const start = new Date(now.getTime() + CLOCK_SKEW_GRACE_MS - 1000);
    const end = new Date(now.getTime() + CLOCK_SKEW_GRACE_MS - 2000);
    expect(validateVisitTimestamps(start, end, now)).toBeNull();
  });

  it("rejects startAt in the future beyond grace", () => {
    const start = new Date(now.getTime() + CLOCK_SKEW_GRACE_MS + 1000);
    expect(validateVisitTimestamps(start, null, now)).toBe(
      "Check-in time cannot be in the future",
    );
  });

  it("rejects endAt in the future beyond grace", () => {
    const start = new Date(now.getTime() - 60 * 60 * 1000);
    const end = new Date(now.getTime() + CLOCK_SKEW_GRACE_MS + 1000);
    expect(validateVisitTimestamps(start, end, now)).toBe(
      "Check-out time cannot be in the future",
    );
  });
});
