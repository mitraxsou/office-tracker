import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as requestOtp } from "../src/app/api/auth/otp/request/route";
import { POST as verifyOtp } from "../src/app/api/auth/otp/verify/route";

vi.mock("../src/lib/otp-auth", () => ({
  isPwcEmail: vi.fn((email: string) => email.endsWith("@pwc.com")),
  sendLoginOtp: vi.fn(),
  verifyLoginOtp: vi.fn(),
}));

vi.mock("../src/lib/auth-rate-limit", () => ({
  checkOtpRequestRateLimits: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
  recordOtpRequestRateLimits: vi.fn(),
  checkOtpVerifyRateLimits: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
  recordOtpVerifyRateLimit: vi.fn(),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("../src/lib/auth", () => ({
  clearLoginAttempts: vi.fn(),
  setSessionCookieOnResponse: vi.fn(),
  recordFailedLoginAttempt: vi.fn(),
}));

vi.mock("../src/lib/welcome-token", () => ({
  setWelcomeToken: vi.fn(),
  setInstallToken: vi.fn(),
}));

vi.mock("../src/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../src/lib/legal-config", () => ({
  getCurrentLegalVersion: vi.fn().mockResolvedValue(1),
}));

import { sendLoginOtp, verifyLoginOtp } from "../src/lib/otp-auth";
import {
  checkOtpRequestRateLimits,
  checkOtpVerifyRateLimits,
  recordOtpRequestRateLimits,
} from "../src/lib/auth-rate-limit";
import { setSessionCookieOnResponse, clearLoginAttempts, recordFailedLoginAttempt } from "../src/lib/auth";
import { setWelcomeToken, setInstallToken } from "../src/lib/welcome-token";
import { prisma } from "../src/lib/db";

function mockVerifiedUser(overrides?: {
  mustChangePassword?: boolean;
  termsAcceptedVersion?: number | null;
}) {
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    mustChangePassword: overrides?.mustChangePassword ?? false,
    email: "user@pwc.com",
    termsAcceptedAt: overrides?.termsAcceptedVersion ? new Date("2026-09-01") : null,
    termsAcceptedVersion: overrides?.termsAcceptedVersion ?? null,
  } as never);
}

describe("POST /api/auth/otp/request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkOtpRequestRateLimits).mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  });

  it("returns 400 when email is missing", async () => {
    const res = await requestOtp(
      new Request("http://localhost/api/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    vi.mocked(checkOtpRequestRateLimits).mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 45,
      error: "Too many code requests. Try again in 15 minutes.",
    });
    const res = await requestOtp(
      new Request("http://localhost/api/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ email: "user@pwc.com" }),
      }),
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.retryAfterSeconds).toBe(45);
  });

  it("returns 400 when otp request fails validation", async () => {
    vi.mocked(sendLoginOtp).mockResolvedValue({
      ok: false,
      error: "Use your PwC email address",
      status: 400,
    });
    const res = await requestOtp(
      new Request("http://localhost/api/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ email: "bad@example.com" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns ok when otp is sent and records rate limits", async () => {
    vi.mocked(sendLoginOtp).mockResolvedValue({ ok: true, sent: true });
    const res = await requestOtp(
      new Request("http://localhost/api/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ email: "user@pwc.com" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(recordOtpRequestRateLimits).toHaveBeenCalledWith("user@pwc.com", "127.0.0.1");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.sent).toBe(true);
  });

  it("returns ok without recording limits when email is not sent (anti-enumeration)", async () => {
    vi.mocked(sendLoginOtp).mockResolvedValue({ ok: true, sent: false });
    const res = await requestOtp(
      new Request("http://localhost/api/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ email: "unknown@pwc.com" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(recordOtpRequestRateLimits).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/otp/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkOtpVerifyRateLimits).mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  });

  it("returns 400 when fields are missing", async () => {
    const res = await verifyOtp(
      new Request("http://localhost/api/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ email: "user@pwc.com" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 429 when verify rate limited", async () => {
    vi.mocked(checkOtpVerifyRateLimits).mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 30,
      error: "Too many verification attempts.",
    });
    const res = await verifyOtp(
      new Request("http://localhost/api/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ email: "user@pwc.com", code: "123456" }),
      }),
    );
    expect(res.status).toBe(429);
  });

  it("records failed login attempt on invalid code", async () => {
    vi.mocked(verifyLoginOtp).mockResolvedValue({
      ok: false,
      error: "Invalid code",
      invalidCode: true,
    });
    const res = await verifyOtp(
      new Request("http://localhost/api/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ email: "user@pwc.com", code: "000000" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(recordFailedLoginAttempt).toHaveBeenCalled();
  });

  it("creates session and terms accept redirect for new users", async () => {
    vi.mocked(verifyLoginOtp).mockResolvedValue({
      ok: true,
      userId: "u1",
      isNewUser: true,
      plainAgentToken: "token-abc",
    });
    mockVerifiedUser();

    const res = await verifyOtp(
      new Request("http://localhost/api/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ email: "user@pwc.com", code: "123456" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(clearLoginAttempts).toHaveBeenCalled();
    expect(setSessionCookieOnResponse).toHaveBeenCalled();
    expect(setWelcomeToken).toHaveBeenCalledWith("token-abc");
    expect(setInstallToken).toHaveBeenCalledWith("token-abc");
    const body = await res.json();
    expect(body.redirectTo).toBe("/terms/accept?next=%2Fsettings%3Fwelcome%3D1");
  });

  it("redirects existing users without terms to accept page", async () => {
    vi.mocked(verifyLoginOtp).mockResolvedValue({
      ok: true,
      userId: "u1",
      isNewUser: false,
    });
    mockVerifiedUser();

    const res = await verifyOtp(
      new Request("http://localhost/api/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ email: "user@pwc.com", code: "123456" }),
      }),
    );

    const body = await res.json();
    expect(body.redirectTo).toBe("/terms/accept?next=%2Fdashboard");
    expect(setWelcomeToken).not.toHaveBeenCalled();
  });

  it("redirects existing users with terms to dashboard", async () => {
    vi.mocked(verifyLoginOtp).mockResolvedValue({
      ok: true,
      userId: "u1",
      isNewUser: false,
    });
    mockVerifiedUser({ termsAcceptedVersion: 1 });

    const res = await verifyOtp(
      new Request("http://localhost/api/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ email: "user@pwc.com", code: "123456" }),
      }),
    );

    const body = await res.json();
    expect(body.redirectTo).toBe("/dashboard");
  });
});
