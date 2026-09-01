import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { isTokenExpired } from "../src/lib/token-expiry";

describe("isTokenExpired", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false for bound tokens regardless of expiresAt", () => {
    expect(
      isTokenExpired({
        revokedAt: null,
        boundSerialNumber: "ABC123",
        expiresAt: new Date("2020-01-01"),
      }),
    ).toBe(false);
  });

  it("returns true for pending token past expiresAt", () => {
    expect(
      isTokenExpired({
        revokedAt: null,
        boundSerialNumber: null,
        expiresAt: new Date("2026-08-27T12:00:00Z"),
      }),
    ).toBe(true);
  });

  it("returns false for pending token before expiresAt", () => {
    expect(
      isTokenExpired({
        revokedAt: null,
        boundSerialNumber: null,
        expiresAt: new Date("2026-08-29T12:00:00Z"),
      }),
    ).toBe(false);
  });

  it("returns true when revoked", () => {
    expect(
      isTokenExpired({
        revokedAt: new Date(),
        boundSerialNumber: null,
        expiresAt: null,
      }),
    ).toBe(true);
  });
});
