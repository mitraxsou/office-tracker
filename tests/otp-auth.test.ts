import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  countRecentOtpRequests,
  findOrCreateUserByOtp,
  isPwcEmail,
  MAX_OTP_REQUESTS_PER_WINDOW,
  MAX_OTP_VERIFY_ATTEMPTS,
  requestLoginOtp,
  verifyLoginOtp,
} from "../src/lib/otp-auth";

vi.mock("../src/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    loginOtp: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userNotificationPrefs: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../src/lib/app-config", () => ({
  ensureAppConfig: vi.fn().mockResolvedValue({ allowOtpSelfRegistration: false }),
}));

vi.mock("../src/lib/auth", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed"),
  isRegistrationEnvLocked: vi.fn().mockReturnValue(false),
  issueAgentToken: vi.fn().mockResolvedValue({ plainToken: "agent-token" }),
}));

vi.mock("../src/lib/power-automate-notify", () => ({
  postWebhookPayload: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../src/lib/audit-log", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "../src/lib/db";
import { postWebhookPayload } from "../src/lib/power-automate-notify";
import { ensureAppConfig } from "../src/lib/app-config";
import { isRegistrationEnvLocked } from "../src/lib/auth";

describe("isPwcEmail", () => {
  it("accepts pwc.com and subdomains", () => {
    expect(isPwcEmail("user@pwc.com")).toBe(true);
    expect(isPwcEmail("user@uk.pwc.com")).toBe(true);
    expect(isPwcEmail("user@pwc.office")).toBe(true);
  });

  it("rejects non-pwc domains", () => {
    expect(isPwcEmail("user@gmail.com")).toBe(false);
  });
});

describe("requestLoginOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-characters";
    vi.mocked(isRegistrationEnvLocked).mockReturnValue(false);
    vi.mocked(ensureAppConfig).mockResolvedValue({
      allowOtpSelfRegistration: false,
      hoursTarget: 5,
      monthlyDaysTarget: 8,
      officeSsids: [],
      maxDevicesPerUser: 10,
      allowRegistration: false,
      pendingTokenTtlDays: 7,
      heartbeatRetentionDays: 7,
      agentStaleMinutes: 8,
      agentStaleGraceHours: 24,
      complianceExemptionRequiresApproval: true,
      pilotStartMonthKey: "2026-09",
    });
  });

  it("rejects non-pwc email", async () => {
    const result = await requestLoginOtp("user@gmail.com");
    expect(result).toEqual({ ok: false, error: "Use your PwC email address" });
  });

  it("rejects unknown email when self-registration is off", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const result = await requestLoginOtp("user@pwc.com");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("No account found");
    }
  });

  it("rate limits repeated requests", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      email: "user@pwc.com",
      name: "User",
    } as never);
    vi.mocked(prisma.loginOtp.count).mockResolvedValue(MAX_OTP_REQUESTS_PER_WINDOW);
    const result = await requestLoginOtp("user@pwc.com");
    expect(result).toEqual({
      ok: false,
      error: "Too many code requests. Try again in 15 minutes.",
    });
  });

  it("stores otp and posts login_otp webhook for existing user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      email: "user@pwc.com",
      name: "User",
    } as never);
    vi.mocked(prisma.loginOtp.count).mockResolvedValue(0);
    vi.mocked(prisma.loginOtp.create).mockResolvedValue({ id: "otp1" } as never);

    const result = await requestLoginOtp("user@pwc.com");
    expect(result).toEqual({ ok: true });
    expect(prisma.loginOtp.create).toHaveBeenCalled();
    expect(postWebhookPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "login_otp",
        email: "user@pwc.com",
        otpExpiresMinutes: 10,
      }),
    );
  });
});

describe("verifyLoginOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-32-characters";
  });

  it("rejects invalid code format", async () => {
    const result = await verifyLoginOtp("user@pwc.com", "abc");
    expect(result).toEqual({ ok: false, error: "Enter the 6-digit code" });
  });

  it("rejects expired otp", async () => {
    vi.mocked(prisma.loginOtp.findFirst).mockResolvedValue({
      id: "otp1",
      email: "user@pwc.com",
      codeHash: "hash",
      expiresAt: new Date(Date.now() - 1000),
      attempts: 0,
      createdAt: new Date(),
    });
    const result = await verifyLoginOtp("user@pwc.com", "123456");
    expect(result.ok).toBe(false);
  });

  it("rejects after max attempts", async () => {
    vi.mocked(prisma.loginOtp.findFirst).mockResolvedValue({
      id: "otp1",
      email: "user@pwc.com",
      codeHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
      attempts: MAX_OTP_VERIFY_ATTEMPTS,
      createdAt: new Date(),
    });
    const result = await verifyLoginOtp("user@pwc.com", "123456");
    expect(result).toEqual({ ok: false, error: "Too many attempts. Request a new code." });
  });
});

describe("findOrCreateUserByOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isRegistrationEnvLocked).mockReturnValue(false);
    vi.mocked(ensureAppConfig).mockResolvedValue({
      allowOtpSelfRegistration: true,
      hoursTarget: 5,
      monthlyDaysTarget: 8,
      officeSsids: [],
      maxDevicesPerUser: 10,
      allowRegistration: false,
      pendingTokenTtlDays: 7,
      heartbeatRetentionDays: 7,
      agentStaleMinutes: 8,
      agentStaleGraceHours: 24,
      complianceExemptionRequiresApproval: true,
      pilotStartMonthKey: "2026-09",
    });
  });

  it("returns existing user without creating", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "u1" } as never);
    const result = await findOrCreateUserByOtp("user@pwc.com");
    expect(result).toEqual({ userId: "u1", isNewUser: false });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("creates user with otp_self source when allowed", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ id: "new-u" } as never);
    vi.mocked(prisma.userNotificationPrefs.create).mockResolvedValue({} as never);

    const result = await findOrCreateUserByOtp("new@pwc.com");
    expect(result).toEqual({
      userId: "new-u",
      isNewUser: true,
      plainAgentToken: "agent-token",
    });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ registrationSource: "otp_self" }),
      }),
    );
  });
});

describe("countRecentOtpRequests", () => {
  it("counts within the request window", async () => {
    vi.mocked(prisma.loginOtp.count).mockResolvedValue(2);
    const count = await countRecentOtpRequests("user@pwc.com");
    expect(count).toBe(2);
    expect(prisma.loginOtp.count).toHaveBeenCalled();
  });
});
