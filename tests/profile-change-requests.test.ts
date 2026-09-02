import { describe, expect, it } from "vitest";
import {
  getProfileChangeBlockReason,
  isPwcEmail,
  isValidProfileChangeStatus,
  normalizeProfileEmail,
  validateProfileChangeSubmission,
} from "../src/lib/profile-change-requests";

describe("isPwcEmail", () => {
  it("accepts @pwc.com addresses", () => {
    expect(isPwcEmail("user@pwc.com")).toBe(true);
    expect(isPwcEmail("User@PWC.COM")).toBe(true);
  });

  it("accepts member firm subdomains", () => {
    expect(isPwcEmail("user@uk.pwc.com")).toBe(true);
    expect(isPwcEmail("user@us.pwc.com")).toBe(true);
  });

  it("accepts pilot @pwc.office addresses", () => {
    expect(isPwcEmail("user@pwc.office")).toBe(true);
  });

  it("rejects non-PwC domains", () => {
    expect(isPwcEmail("user@gmail.com")).toBe(false);
    expect(isPwcEmail("user@notpwc.com")).toBe(false);
    expect(isPwcEmail("invalid")).toBe(false);
  });
});

describe("normalizeProfileEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeProfileEmail("  User@PWC.com ")).toBe("user@pwc.com");
  });
});

describe("isValidProfileChangeStatus", () => {
  it("accepts open, approved, rejected", () => {
    expect(isValidProfileChangeStatus("open")).toBe(true);
    expect(isValidProfileChangeStatus("approved")).toBe(true);
    expect(isValidProfileChangeStatus("rejected")).toBe(true);
  });

  it("rejects unknown statuses", () => {
    expect(isValidProfileChangeStatus("pending")).toBe(false);
  });
});

describe("validateProfileChangeSubmission", () => {
  it("requires at least one field", () => {
    expect(
      validateProfileChangeSubmission({
        currentName: "Alice",
        currentEmail: "alice@pwc.com",
        hasOpenRequest: false,
      }),
    ).toBe("Provide a new display name and/or email");
  });

  it("rejects non-PwC email", () => {
    expect(
      validateProfileChangeSubmission({
        currentName: "Alice",
        currentEmail: "alice@pwc.com",
        requestedEmail: "alice@gmail.com",
        hasOpenRequest: false,
      }),
    ).toBe("Email must be a PwC address (for example user@pwc.com or user@uk.pwc.com)");
  });

  it("rejects unchanged values", () => {
    expect(
      validateProfileChangeSubmission({
        currentName: "Alice",
        currentEmail: "alice@pwc.com",
        requestedName: "Alice",
        hasOpenRequest: false,
      }),
    ).toBe("Requested name and email match your current profile");
  });

  it("rejects duplicate open request", () => {
    expect(
      validateProfileChangeSubmission({
        currentName: "Alice",
        currentEmail: "alice@pwc.com",
        requestedName: "Bob",
        hasOpenRequest: true,
      }),
    ).toBe("You already have a pending profile change request");
  });

  it("allows valid name change", () => {
    expect(
      validateProfileChangeSubmission({
        currentName: "Alice",
        currentEmail: "alice@pwc.com",
        requestedName: "Bob",
        hasOpenRequest: false,
      }),
    ).toBeNull();
  });

  it("allows valid email change", () => {
    expect(
      validateProfileChangeSubmission({
        currentName: "Alice",
        currentEmail: "alice@pwc.com",
        requestedEmail: "alice@uk.pwc.com",
        hasOpenRequest: false,
      }),
    ).toBeNull();
  });
});

describe("getProfileChangeBlockReason", () => {
  it("blocks breakglass email", () => {
    process.env.BREAKGLASS_EMAIL = "breakglass@pwc.office";
    expect(getProfileChangeBlockReason("breakglass@pwc.office")).toBe(
      "Breakglass account profile is managed via server environment",
    );
  });

  it("allows regular users", () => {
    process.env.BREAKGLASS_EMAIL = "breakglass@pwc.office";
    expect(getProfileChangeBlockReason("user@pwc.com")).toBeNull();
  });
});
