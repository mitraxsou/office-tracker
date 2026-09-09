import { describe, expect, it } from "vitest";
import {
  isValidAdminContactCategory,
  isValidAdminContactStatus,
  normalizeAdminContactStatus,
  validateAdminContactMessage,
  validateAdminContactStatusTransition,
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
  it("accepts open and closed", () => {
    expect(isValidAdminContactStatus("open")).toBe(true);
    expect(isValidAdminContactStatus("closed")).toBe(true);
  });

  it("rejects unknown statuses", () => {
    expect(isValidAdminContactStatus("resolved")).toBe(false);
  });
});

describe("normalizeAdminContactStatus", () => {
  it("maps legacy resolved to closed", () => {
    expect(normalizeAdminContactStatus("resolved")).toBe("closed");
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

describe("validateAdminContactMessage", () => {
  it("rejects empty or short replies", () => {
    expect(validateAdminContactMessage(" ")).toBe("Message is required");
    expect(validateAdminContactMessage("a")).toBe("Message must be at least 2 characters");
  });

  it("allows valid thread messages", () => {
    expect(validateAdminContactMessage("Thanks for the update.")).toBeNull();
  });
});

describe("validateAdminContactStatusTransition", () => {
  it("blocks closing an already closed thread", () => {
    expect(
      validateAdminContactStatusTransition({ currentStatus: "closed", action: "close" }),
    ).toBe("Conversation is already closed");
  });

  it("blocks reopening an open thread", () => {
    expect(
      validateAdminContactStatusTransition({ currentStatus: "open", action: "reopen" }),
    ).toBe("Conversation is already open");
  });

  it("allows close from open and reopen from closed", () => {
    expect(
      validateAdminContactStatusTransition({ currentStatus: "open", action: "close" }),
    ).toBeNull();
    expect(
      validateAdminContactStatusTransition({ currentStatus: "closed", action: "reopen" }),
    ).toBeNull();
    expect(
      validateAdminContactStatusTransition({ currentStatus: "resolved", action: "reopen" }),
    ).toBeNull();
  });
});
