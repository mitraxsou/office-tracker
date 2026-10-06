import { describe, expect, it } from "vitest";
import {
  canImmediateAgentTokenReissue,
  isValidTokenRegenKind,
  isValidTokenRegenRequestStatus,
  validateTokenRegenSubmission,
} from "../src/lib/agent-token-regenerate-requests";

describe("token regenerate request helpers", () => {
  it("accepts open, approved, rejected", () => {
    expect(isValidTokenRegenRequestStatus("open")).toBe(true);
    expect(isValidTokenRegenRequestStatus("approved")).toBe(true);
    expect(isValidTokenRegenRequestStatus("rejected")).toBe(true);
    expect(isValidTokenRegenRequestStatus("pending")).toBe(false);
  });

  it("accepts known kinds", () => {
    expect(isValidTokenRegenKind("regenerate")).toBe(true);
    expect(isValidTokenRegenKind("refresh_install_commands")).toBe(true);
    expect(isValidTokenRegenKind("other")).toBe(false);
  });

  it("blocks Settings self-reissue for admins and regular users", () => {
    expect(canImmediateAgentTokenReissue({ role: "admin" })).toBe(false);
    expect(canImmediateAgentTokenReissue({ role: "user" })).toBe(false);
  });

  it("rejects invalid kind and duplicate open requests", () => {
    expect(
      validateTokenRegenSubmission({ kind: "nope", hasOpenRequest: false }),
    ).toBe("Invalid request type");
    expect(
      validateTokenRegenSubmission({
        kind: "regenerate",
        tokenId: "tok-1",
        hasOpenRequest: true,
      }),
    ).toBe("You already have a pending token regenerate request");
  });

  it("allows a regenerate request", () => {
    expect(
      validateTokenRegenSubmission({
        kind: "regenerate",
        tokenId: "tok-1",
        hasOpenRequest: false,
      }),
    ).toBeNull();
  });
});
