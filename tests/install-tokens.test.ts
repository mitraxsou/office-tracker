import { describe, expect, it } from "vitest";
import { revealStoredPendingToken } from "../src/lib/auth";
import { encryptPendingToken } from "../src/lib/token-crypto";

describe("revealStoredPendingToken", () => {
  it("returns plain token for bound laptop when encrypted copy is kept", () => {
    const plain = "a".repeat(64);
    const enc = encryptPendingToken(plain);
    const result = revealStoredPendingToken({
      pendingTokenEnc: enc,
      boundSerialNumber: "PG04YGZF",
      revokedAt: null,
      expiresAt: null,
    });
    expect(result).toBe(plain);
  });

  it("returns null when encrypted copy was cleared", () => {
    const result = revealStoredPendingToken({
      pendingTokenEnc: null,
      boundSerialNumber: "PG04YGZF",
      revokedAt: null,
      expiresAt: null,
    });
    expect(result).toBeNull();
  });

  it("legacy bound tokens without encrypted copy cannot reveal install command", () => {
    const plain = "b".repeat(64);
    const enc = encryptPendingToken(plain);
    expect(
      revealStoredPendingToken({
        pendingTokenEnc: enc,
        boundSerialNumber: "ABC123",
        revokedAt: null,
        expiresAt: null,
      }),
    ).toBe(plain);
    expect(
      revealStoredPendingToken({
        pendingTokenEnc: null,
        boundSerialNumber: "ABC123",
        revokedAt: null,
        expiresAt: null,
      }),
    ).toBeNull();
  });
});
