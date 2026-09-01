import { describe, expect, it } from "vitest";
import {
  isValidTimezoneRequestStatus,
  timezoneOnApproval,
  validateTimezoneChangeSubmission,
} from "../src/lib/timezone-requests";

describe("isValidTimezoneRequestStatus", () => {
  it("accepts open, approved, rejected", () => {
    expect(isValidTimezoneRequestStatus("open")).toBe(true);
    expect(isValidTimezoneRequestStatus("approved")).toBe(true);
    expect(isValidTimezoneRequestStatus("rejected")).toBe(true);
  });

  it("rejects unknown statuses", () => {
    expect(isValidTimezoneRequestStatus("pending")).toBe(false);
    expect(isValidTimezoneRequestStatus("")).toBe(false);
  });
});

describe("validateTimezoneChangeSubmission", () => {
  it("rejects invalid timezone", () => {
    expect(
      validateTimezoneChangeSubmission({
        currentTimezone: "Asia/Kolkata",
        requestedTimezone: "Not/AZone",
        hasOpenRequest: false,
      }),
    ).toBe("Invalid timezone");
  });

  it("rejects when requested matches current", () => {
    expect(
      validateTimezoneChangeSubmission({
        currentTimezone: "Asia/Kolkata",
        requestedTimezone: "Asia/Kolkata",
        hasOpenRequest: false,
      }),
    ).toBe("Requested timezone matches your current timezone");
  });

  it("rejects duplicate open request", () => {
    expect(
      validateTimezoneChangeSubmission({
        currentTimezone: "Asia/Kolkata",
        requestedTimezone: "Europe/London",
        hasOpenRequest: true,
      }),
    ).toBe("You already have a pending timezone change request");
  });

  it("allows valid submission", () => {
    expect(
      validateTimezoneChangeSubmission({
        currentTimezone: "Asia/Kolkata",
        requestedTimezone: "Europe/London",
        hasOpenRequest: false,
      }),
    ).toBeNull();
  });
});

describe("timezoneOnApproval", () => {
  it("returns requested timezone on approve", () => {
    expect(timezoneOnApproval("approved", "Europe/London", "Asia/Kolkata")).toBe(
      "Europe/London",
    );
  });

  it("keeps current timezone on reject", () => {
    expect(timezoneOnApproval("rejected", "Europe/London", "Asia/Kolkata")).toBe(
      "Asia/Kolkata",
    );
  });
});
