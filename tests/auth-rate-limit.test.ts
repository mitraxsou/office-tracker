import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_RATE_LIMIT_BUCKETS,
  checkOtpRequestRateLimits,
  checkOtpResendCooldown,
  checkRateLimit,
  getClientIp,
  hashRateLimitKey,
  recordRateLimitEvent,
} from "../src/lib/auth-rate-limit";

vi.mock("../src/lib/db", () => ({
  prisma: {
    authRateLimitEvent: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from "../src/lib/db";

describe("getClientIp", () => {
  it("reads first x-forwarded-for hop", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const request = new Request("http://localhost", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(getClientIp(request)).toBe("9.9.9.9");
  });
});

describe("hashRateLimitKey", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-characters";
  });

  it("returns stable hashed keys", () => {
    const a = hashRateLimitKey("user@pwc.com");
    const b = hashRateLimitKey("user@pwc.com");
    expect(a).toBe(b);
    expect(a).not.toBe("user@pwc.com");
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-characters";
    vi.clearAllMocks();
  });

  it("allows when under max", async () => {
    vi.mocked(prisma.authRateLimitEvent.findMany).mockResolvedValue([]);
    const result = await checkRateLimit(AUTH_RATE_LIMIT_BUCKETS.otpRequestIp, "1.2.3.4", {
      max: 3,
      windowMs: 60_000,
    });
    expect(result.allowed).toBe(true);
  });

  it("blocks when at max and returns retryAfterSeconds", async () => {
    const createdAt = new Date(Date.now() - 30_000);
    vi.mocked(prisma.authRateLimitEvent.findMany).mockResolvedValue([
      { createdAt },
      { createdAt },
      { createdAt },
    ]);
    const result = await checkRateLimit(AUTH_RATE_LIMIT_BUCKETS.otpRequestIp, "1.2.3.4", {
      max: 3,
      windowMs: 60_000,
    });
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("checkOtpResendCooldown", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-characters";
    vi.clearAllMocks();
  });

  it("blocks resend within 60 seconds", async () => {
    vi.mocked(prisma.authRateLimitEvent.findFirst).mockResolvedValue({
      createdAt: new Date(Date.now() - 10_000),
    });
    const result = await checkOtpResendCooldown("user@pwc.com");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(40);
  });
});

describe("checkOtpRequestRateLimits", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-characters";
    vi.clearAllMocks();
    vi.mocked(prisma.authRateLimitEvent.findMany).mockResolvedValue([]);
    vi.mocked(prisma.authRateLimitEvent.findFirst).mockResolvedValue(null);
  });

  it("enforces resend cooldown when isResend is true", async () => {
    vi.mocked(prisma.authRateLimitEvent.findFirst).mockResolvedValue({
      createdAt: new Date(Date.now() - 5_000),
    });
    const result = await checkOtpRequestRateLimits("user@pwc.com", "1.2.3.4", true);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("recordRateLimitEvent", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-characters";
    vi.mocked(prisma.authRateLimitEvent.create).mockResolvedValue({ id: "e1" } as never);
  });

  it("stores hashed bucket events", async () => {
    await recordRateLimitEvent(AUTH_RATE_LIMIT_BUCKETS.otpRequestEmail, "user@pwc.com");
    expect(prisma.authRateLimitEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bucket: AUTH_RATE_LIMIT_BUCKETS.otpRequestEmail,
        key: hashRateLimitKey("user@pwc.com"),
      }),
    });
  });
});
