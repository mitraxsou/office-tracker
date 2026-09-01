import { describe, expect, it, beforeAll } from "vitest";
import {
  createOutOfOfficeLinkToken,
  redeemOutOfOfficeLinkToken,
} from "../src/lib/out-of-office";

beforeAll(() => {
  process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "test-auth-secret-at-least-32-chars-long";
});

describe("out-of-office links", () => {
  it("rejects tokens with wrong purpose", async () => {
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
    const bad = await new SignJWT({ userId: "u1", dayKey: "2026-09-02", purpose: "other" })
      .setProtectedHeader({ alg: "HS256" })
      .sign(secret);
    await expect(redeemOutOfOfficeLinkToken(bad)).rejects.toThrow();
  });

  it("creates a verifiable token payload shape", async () => {
    const token = await createOutOfOfficeLinkToken("user-test-id", "2026-09-02");
    expect(token.split(".")).toHaveLength(3);
  });
});
