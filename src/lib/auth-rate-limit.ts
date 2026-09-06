import crypto from "node:crypto";
import { prisma } from "./db";

export const OTP_REQUEST_EMAIL_MAX = 3;
export const OTP_REQUEST_EMAIL_WINDOW_MS = 15 * 60 * 1000;
export const OTP_REQUEST_IP_MAX = 10;
export const OTP_REQUEST_IP_WINDOW_MS = 15 * 60 * 1000;
export const OTP_VERIFY_IP_MAX = 20;
export const OTP_VERIFY_IP_WINDOW_MS = 15 * 60 * 1000;
export const OTP_VERIFY_EMAIL_MAX = 10;
export const OTP_VERIFY_EMAIL_WINDOW_MS = 15 * 60 * 1000;
import { OTP_RESEND_COOLDOWN_MS } from "./auth-rate-limit-constants";
export const PASSWORD_LOGIN_IP_MAX = 15;
export const PASSWORD_LOGIN_IP_WINDOW_MS = 15 * 60 * 1000;

export const AUTH_RATE_LIMIT_BUCKETS = {
  otpRequestEmail: "otp_request:email",
  otpRequestIp: "otp_request:ip",
  otpVerifyIp: "otp_verify:ip",
  otpVerifyEmail: "otp_verify:email",
  otpResendCooldown: "otp_resend:cooldown",
  passwordLoginIp: "password_login:ip",
} as const;

export type RateLimitBucket = (typeof AUTH_RATE_LIMIT_BUCKETS)[keyof typeof AUTH_RATE_LIMIT_BUCKETS];

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export function getClientIpFromHeaders(headerStore: Headers): string {
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headerStore.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export function hashRateLimitKey(value: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET must be set");
  }
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export async function countRecentRateLimitEvents(
  bucket: RateLimitBucket,
  key: string,
  windowMs: number,
): Promise<number> {
  const since = new Date(Date.now() - windowMs);
  return prisma.authRateLimitEvent.count({
    where: { bucket, key, createdAt: { gte: since } },
  });
}

export async function getLatestRateLimitEvent(
  bucket: RateLimitBucket,
  key: string,
): Promise<Date | null> {
  const row = await prisma.authRateLimitEvent.findFirst({
    where: { bucket, key },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}

function retryAfterSecondsFromCount(
  count: number,
  max: number,
  windowMs: number,
  oldestCreatedAt?: Date | null,
): number {
  if (count < max) return 0;
  if (!oldestCreatedAt) return Math.ceil(windowMs / 1000);
  const elapsed = Date.now() - oldestCreatedAt.getTime();
  const remaining = windowMs - elapsed;
  return Math.max(1, Math.ceil(remaining / 1000));
}

export async function checkRateLimit(
  bucket: RateLimitBucket,
  rawKey: string,
  options: { max: number; windowMs: number },
): Promise<RateLimitResult> {
  const key = hashRateLimitKey(rawKey);
  const since = new Date(Date.now() - options.windowMs);
  const rows = await prisma.authRateLimitEvent.findMany({
    where: { bucket, key, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  if (rows.length < options.max) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: retryAfterSecondsFromCount(
      rows.length,
      options.max,
      options.windowMs,
      rows[0]?.createdAt,
    ),
  };
}

export async function checkOtpResendCooldown(email: string): Promise<RateLimitResult> {
  const key = hashRateLimitKey(email.toLowerCase());
  const last = await getLatestRateLimitEvent(AUTH_RATE_LIMIT_BUCKETS.otpResendCooldown, key);
  if (!last) return { allowed: true, retryAfterSeconds: 0 };

  const elapsed = Date.now() - last.getTime();
  if (elapsed >= OTP_RESEND_COOLDOWN_MS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000)),
  };
}

export async function recordRateLimitEvent(bucket: RateLimitBucket, rawKey: string): Promise<void> {
  const key = hashRateLimitKey(rawKey);
  await prisma.authRateLimitEvent.create({
    data: { bucket, key },
  });
}

export async function purgeOldRateLimitEvents(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = await prisma.authRateLimitEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}

export type OtpRequestRateLimitCheck = {
  allowed: boolean;
  retryAfterSeconds: number;
  error?: string;
};

export async function checkOtpRequestRateLimits(
  email: string,
  ip: string,
  isResend: boolean,
): Promise<OtpRequestRateLimitCheck> {
  const normalizedEmail = email.toLowerCase();

  const ipLimit = await checkRateLimit(AUTH_RATE_LIMIT_BUCKETS.otpRequestIp, ip, {
    max: OTP_REQUEST_IP_MAX,
    windowMs: OTP_REQUEST_IP_WINDOW_MS,
  });
  if (!ipLimit.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: ipLimit.retryAfterSeconds,
      error: "Too many sign-in attempts from this network. Try again later.",
    };
  }

  const emailLimit = await checkRateLimit(AUTH_RATE_LIMIT_BUCKETS.otpRequestEmail, normalizedEmail, {
    max: OTP_REQUEST_EMAIL_MAX,
    windowMs: OTP_REQUEST_EMAIL_WINDOW_MS,
  });
  if (!emailLimit.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: emailLimit.retryAfterSeconds,
      error: "Too many code requests. Try again in 15 minutes.",
    };
  }

  if (isResend) {
    const cooldown = await checkOtpResendCooldown(normalizedEmail);
    if (!cooldown.allowed) {
      return {
        allowed: false,
        retryAfterSeconds: cooldown.retryAfterSeconds,
        error: `Wait ${cooldown.retryAfterSeconds} seconds before requesting another code.`,
      };
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export async function recordOtpRequestRateLimits(email: string, ip: string): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  await recordRateLimitEvent(AUTH_RATE_LIMIT_BUCKETS.otpRequestIp, ip);
  await recordRateLimitEvent(AUTH_RATE_LIMIT_BUCKETS.otpRequestEmail, normalizedEmail);
  await recordRateLimitEvent(AUTH_RATE_LIMIT_BUCKETS.otpResendCooldown, normalizedEmail);
}

export async function checkOtpVerifyRateLimits(
  email: string,
  ip: string,
): Promise<OtpRequestRateLimitCheck> {
  const normalizedEmail = email.toLowerCase();

  const ipLimit = await checkRateLimit(AUTH_RATE_LIMIT_BUCKETS.otpVerifyIp, ip, {
    max: OTP_VERIFY_IP_MAX,
    windowMs: OTP_VERIFY_IP_WINDOW_MS,
  });
  if (!ipLimit.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: ipLimit.retryAfterSeconds,
      error: "Too many verification attempts from this network. Try again later.",
    };
  }

  const emailLimit = await checkRateLimit(AUTH_RATE_LIMIT_BUCKETS.otpVerifyEmail, normalizedEmail, {
    max: OTP_VERIFY_EMAIL_MAX,
    windowMs: OTP_VERIFY_EMAIL_WINDOW_MS,
  });
  if (!emailLimit.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: emailLimit.retryAfterSeconds,
      error: "Too many verification attempts. Try again later.",
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export async function recordOtpVerifyRateLimit(email: string, ip: string): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  await recordRateLimitEvent(AUTH_RATE_LIMIT_BUCKETS.otpVerifyIp, ip);
  await recordRateLimitEvent(AUTH_RATE_LIMIT_BUCKETS.otpVerifyEmail, normalizedEmail);
}

export async function checkPasswordLoginIpLimit(ip: string): Promise<RateLimitResult> {
  return checkRateLimit(AUTH_RATE_LIMIT_BUCKETS.passwordLoginIp, ip, {
    max: PASSWORD_LOGIN_IP_MAX,
    windowMs: PASSWORD_LOGIN_IP_WINDOW_MS,
  });
}

export async function recordPasswordLoginIpAttempt(ip: string): Promise<void> {
  await recordRateLimitEvent(AUTH_RATE_LIMIT_BUCKETS.passwordLoginIp, ip);
}
