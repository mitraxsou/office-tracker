import { describe, expect, it } from "vitest";
import {
  isValidAdminContactCategory,
  isValidAdminContactStatus,
  validateAdminContactResolution,
  validateAdminContactSubmission,
} from "../src/lib/admin-contact";

describe("isValidAdminContactCategory", () => {
  it("accepts issue, concern, feedback", () => {
    expect(isValidAdminContactCategory("issue")).toBe(true);
    expect(isValidAdminContactCategory("concern")).toBe(true);
    expect(isValidAdminContactCategory("feedback")).toBe(true);
  });

  it("rejects unknown categories", () => {
    expect(isValidAdminContactCategory("complaint")).toBe(false);
    expect(isValidAdminContactCategory("")).toBe(false);
  });
});

describe("isValidAdminContactStatus", () => {
  it("accepts open and resolved", () => {
    expect(isValidAdminContactStatus("open")).toBe(true);
    expect(isValidAdminContactStatus("resolved")).toBe(true);
  });

  it("rejects unknown statuses", () => {
    expect(isValidAdminContactStatus("closed")).toBe(false);
  });
});

describe("validateAdminContactSubmission", () => {
  it("rejects invalid category", () => {
    expect(
      validateAdminContactSubmission({ category: "other", message: "Valid message here" }),
    ).toBe("Category must be issue, concern, or feedback");
  });

  it("rejects empty or short message", () => {
    expect(validateAdminContactSubmission({ category: "issue", message: "   " })).toBe(
      "Message is required",
    );
    expect(validateAdminContactSubmission({ category: "issue", message: "short" })).toBe(
      "Message must be at least 10 characters",
    );
  });

  it("allows valid submission", () => {
    expect(
      validateAdminContactSubmission({
        category: "feedback",
        message: "The dashboard looks great, thanks!",
      }),
    ).toBeNull();
  });
});

describe("validateAdminContactResolution", () => {
  it("requires admin response when resolving", () => {
    expect(validateAdminContactResolution({ status: "resolved", adminResponse: "" })).toBe(
      "Admin response is required when resolving",
    );
  });

  it("allows resolve with response", () => {
    expect(
      validateAdminContactResolution({
        status: "resolved",
        adminResponse: "Thanks, we fixed this.",
      }),
    ).toBeNull();
  });
});
