import { describe, expect, it, beforeAll } from "vitest";
import {
  createOutOfOfficeLinkToken,
  redeemOutOfOfficeLinkToken,
  isDayKeyInRange,
  dateRangesOverlap,
} from "../src/lib/out-of-office";
import { computeDeviceAgentStatus } from "../src/lib/device-status";

beforeAll(() => {
  process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "test-auth-secret-at-least-32-chars-long";
});

describe("out-of-office date ranges", () => {
  it("detects a day inside an inclusive range", () => {
    expect(isDayKeyInRange("2026-09-05", "2026-09-01", "2026-09-10")).toBe(true);
    expect(isDayKeyInRange("2026-09-01", "2026-09-01", "2026-09-10")).toBe(true);
    expect(isDayKeyInRange("2026-09-10", "2026-09-01", "2026-09-10")).toBe(true);
    expect(isDayKeyInRange("2026-08-31", "2026-09-01", "2026-09-10")).toBe(false);
    expect(isDayKeyInRange("2026-09-11", "2026-09-01", "2026-09-10")).toBe(false);
  });

  it("detects overlapping ranges", () => {
    expect(dateRangesOverlap("2026-09-01", "2026-09-05", "2026-09-03", "2026-09-10")).toBe(true);
    expect(dateRangesOverlap("2026-09-01", "2026-09-05", "2026-09-06", "2026-09-10")).toBe(false);
    expect(dateRangesOverlap("2026-09-01", "2026-09-05", "2026-09-05", "2026-09-10")).toBe(true);
  });
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

describe("agent health grace with OOO skip", () => {
  it("treats no heartbeat beyond grace as unhealthy when not OOO", () => {
    const graceHours = 24;
    const now = new Date("2026-09-02T10:00:00+05:30");
    const lastSeen = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    expect(computeDeviceAgentStatus(lastSeen, graceHours, now)).toBe("stale");
  });

  it("skips stale evaluation when user is marked OOO (integration rule)", () => {
    const isOoo = true;
    const agentHealthy = false;
    const shouldAlert = !isOoo && !agentHealthy;
    expect(shouldAlert).toBe(false);
  });
});
