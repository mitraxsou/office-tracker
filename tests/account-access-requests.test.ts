import { describe, expect, it } from "vitest";
import { validateAccountAccessSubmission } from "../src/lib/account-access-requests";

describe("validateAccountAccessSubmission", () => {
  it("accepts a PwC email", () => {
    expect(
      validateAccountAccessSubmission({
        email: "colleague@pwc.com",
        name: "Alex",
        message: "Joining the pilot",
      }),
    ).toBeNull();
  });

  it("rejects non-PwC email", () => {
    expect(
      validateAccountAccessSubmission({
        email: "person@example.com",
      }),
    ).toMatch(/PwC email/i);
  });

  it("rejects overly long message", () => {
    expect(
      validateAccountAccessSubmission({
        email: "colleague@pwc.com",
        message: "x".repeat(501),
      }),
    ).toMatch(/at most 500/);
  });
});
