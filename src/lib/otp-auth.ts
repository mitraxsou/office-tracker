import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import {
  hashPassword,
  isRegistrationEnvLocked,
  issueAgentToken,
} from "./auth";
import { ensureAppConfig } from "./app-config";
import { isPwcEmail, normalizeProfileEmail } from "./profile-change-requests";
import { postWebhookPayload } from "./power-automate-notify";
import { logAuditEvent } from "./audit-log";
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_WORK_DAYS,
} from "./notification-prefs";

export const OTP_EXPIRES_MINUTES = 10;
export const MAX_OTP_VERIFY_ATTEMPTS = 5;
export const MAX_OTP_REQUESTS_PER_WINDOW = 3;
export const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;

export { isPwcEmail };

function generateOtpCode(): string {
  const num = crypto.randomInt(0, 1_000_000);
  return num.toString().padStart(10, "0").slice(-6);
}

async function hashOtpCode(code: string): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET must be set");
  }
  return bcrypt.hash(`${code}:${secret}`, 10);
}

async function verifyOtpHash(code: string, hash: string): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  return bcrypt.compare(`${code}:${secret}`, hash);
}

export async function isOtpSelfRegistrationAllowed(): Promise<boolean> {
  if (isRegistrationEnvLocked()) return false;
  const config = await ensureAppConfig();
  return config.allowOtpSelfRegistration;
}

export async function countRecentOtpRequests(email: string): Promise<number> {
  const since = new Date(Date.now() - OTP_REQUEST_WINDOW_MS);
  return prisma.loginOtp.count({
    where: { email, createdAt: { gte: since } },
  });
}

export type RequestOtpResult = { ok: true } | { ok: false; error: string };

export async function requestLoginOtp(email: string): Promise<RequestOtpResult> {
  const normalized = normalizeProfileEmail(email);
  if (!isPwcEmail(normalized)) {
    return { ok: false, error: "Use your PwC email address" };
  }

  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (!existing && !(await isOtpSelfRegistrationAllowed())) {
    return {
      ok: false,
      error: "No account found for this email. Contact your pilot admin.",
    };
  }

  const recentCount = await countRecentOtpRequests(normalized);
  if (recentCount >= MAX_OTP_REQUESTS_PER_WINDOW) {
    return { ok: false, error: "Too many code requests. Try again in 15 minutes." };
  }

  const code = generateOtpCode();
  const codeHash = await hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

  await prisma.loginOtp.create({
    data: { email: normalized, codeHash, expiresAt },
  });

  const webhookResult = await postWebhookPayload({
    type: "login_otp",
    email: normalized,
    name: existing?.name ?? normalized.split("@")[0] ?? normalized,
    message: `Your PwC Office Pulse sign-in code is ${code}. It expires in ${OTP_EXPIRES_MINUTES} minutes.`,
    otp: code,
    otpExpiresMinutes: OTP_EXPIRES_MINUTES,
  });

  if (!webhookResult.ok) {
    return { ok: false, error: "Could not send sign-in code. Try again later." };
  }

  if (existing) {
    await logAuditEvent({
      actorId: existing.id,
      action: "otp_request",
      targetUserId: existing.id,
      details: { email: normalized },
    });
  }

  return { ok: true };
}

export type VerifyOtpResult =
  | { ok: true; userId: string; isNewUser: boolean; plainAgentToken?: string }
  | { ok: false; error: string };

export async function verifyLoginOtp(email: string, code: string): Promise<VerifyOtpResult> {
  const normalized = normalizeProfileEmail(email);
  const trimmedCode = code.trim();
  if (!/^\d{6}$/.test(trimmedCode)) {
    return { ok: false, error: "Enter the 6-digit code" };
  }

  const record = await prisma.loginOtp.findFirst({
    where: { email: normalized },
    orderBy: { createdAt: "desc" },
  });

  if (!record || record.expiresAt < new Date()) {
    return { ok: false, error: "Code expired or invalid. Request a new code." };
  }

  if (record.attempts >= MAX_OTP_VERIFY_ATTEMPTS) {
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  const valid = await verifyOtpHash(trimmedCode, record.codeHash);
  if (!valid) {
    await prisma.loginOtp.update({
      where: { id: record.id },
      data: { attempts: record.attempts + 1 },
    });
    const user = await prisma.user.findUnique({ where: { email: normalized } });
    if (user) {
      await logAuditEvent({
        actorId: user.id,
        action: "otp_verify_failed",
        targetUserId: user.id,
        details: { email: normalized },
      });
    }
    return { ok: false, error: "Invalid code" };
  }

  await prisma.loginOtp.delete({ where: { id: record.id } });

  try {
    const result = await findOrCreateUserByOtp(normalized);
    return { ok: true, ...result };
  } catch {
    return { ok: false, error: "Account not found" };
  }
}

export async function findOrCreateUserByOtp(email: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { userId: existing.id, isNewUser: false as const };
  }

  if (!(await isOtpSelfRegistrationAllowed())) {
    throw new Error("Account not found");
  }

  const passwordHash = await hashPassword(crypto.randomBytes(32).toString("hex"));
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "user",
      registrationSource: "otp_self",
    },
  });

  await prisma.userNotificationPrefs.create({
    data: {
      userId: user.id,
      workDays: JSON.stringify(DEFAULT_WORK_DAYS),
      alertIfNotInOffice: DEFAULT_NOTIFICATION_PREFS.alertIfNotInOffice,
      alertIfAgentStale: DEFAULT_NOTIFICATION_PREFS.alertIfAgentStale,
      alertIfBehindHours: DEFAULT_NOTIFICATION_PREFS.alertIfBehindHours,
      alertIfHoursStarted: DEFAULT_NOTIFICATION_PREFS.alertIfHoursStarted,
      alertIfHoursMet: DEFAULT_NOTIFICATION_PREFS.alertIfHoursMet,
      channelNotInOffice: DEFAULT_NOTIFICATION_PREFS.channelNotInOffice,
      channelAgentStale: DEFAULT_NOTIFICATION_PREFS.channelAgentStale,
      channelBehindHours: DEFAULT_NOTIFICATION_PREFS.channelBehindHours,
      channelHoursStarted: DEFAULT_NOTIFICATION_PREFS.channelHoursStarted,
      channelHoursMet: DEFAULT_NOTIFICATION_PREFS.channelHoursMet,
    },
  });

  const { plainToken } = await issueAgentToken(user.id, { label: "Initial laptop" });

  await logAuditEvent({
    actorId: user.id,
    action: "user_create_otp",
    targetUserId: user.id,
    details: { email, registrationSource: "otp_self" },
  });

  return {
    userId: user.id,
    isNewUser: true as const,
    plainAgentToken: plainToken,
  };
}
