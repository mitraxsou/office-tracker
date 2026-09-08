import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { ensureAppConfig, getAppConfig } from "./app-config";
import crypto from "node:crypto";
import { encryptPendingToken, decryptPendingToken } from "./token-crypto";
import { buildInstallCommand, buildUpdateCommand } from "./agent-branding";
import { isTokenExpired, revokeExpiredPendingTokens } from "./token-expiry";
import { clearAgentDeregistration } from "./agent-deregister";
import type { InstallTokenForUser } from "./install-token-types";
import { isBreakglassEmail } from "./breakglass-shared";

export type { InstallTokenForUser } from "./install-token-types";

const SESSION_COOKIE = "office-tracker-session";
const LOGIN_ATTEMPTS_COOKIE = "office-tracker-login-attempts";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const LOGIN_ATTEMPTS_MAX_AGE = 60 * 15;

export const MAX_LOGIN_ATTEMPTS = 3;

const TEMP_PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function generateTempPassword(length = 12) {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += TEMP_PASSWORD_CHARS[bytes[i] % TEMP_PASSWORD_CHARS.length];
  }
  return result;
}

export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const { getSelfPasswordChangeBlockReason, validatePasswordStrength } = await import(
    "./password-policy"
  );

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }

  const blockReason = getSelfPasswordChangeBlockReason(user.email);
  if (blockReason) {
    throw new Error(blockReason);
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new Error("Current password is incorrect");
  }

  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) {
    throw new Error(strengthError);
  }

  if (currentPassword === newPassword) {
    throw new Error("New password must be different from your current password");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword: false,
      passwordResetAt: null,
    },
  });
}

export async function resetUserPasswordByAdmin(userId: string) {
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword: true,
      passwordResetAt: new Date(),
    },
  });
  return tempPassword;
}

export async function getLoginAttemptCount(): Promise<number> {
  const cookieStore = await cookies();
  const val = cookieStore.get(LOGIN_ATTEMPTS_COOKIE)?.value;
  const n = parseInt(val ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
}

export async function recordFailedLoginAttempt(): Promise<number> {
  const cookieStore = await cookies();
  const next = await getLoginAttemptCount() + 1;
  cookieStore.set(LOGIN_ATTEMPTS_COOKIE, String(next), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: LOGIN_ATTEMPTS_MAX_AGE,
    path: "/",
  });
  return next;
}

export async function clearLoginAttempts() {
  const cookieStore = await cookies();
  cookieStore.delete(LOGIN_ATTEMPTS_COOKIE);
}

type SessionPayload = {
  userId: string;
  impersonatingUserId?: string;
};

async function signSessionPayload(payload: SessionPayload) {
  const jwtPayload: Record<string, string> = { userId: payload.userId };
  if (payload.impersonatingUserId) {
    jwtPayload.impersonatingUserId = payload.impersonatingUserId;
  }

  return new SignJWT(jwtPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

async function writeSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

async function readSessionPayload(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = typeof payload.userId === "string" ? payload.userId : null;
    if (!userId) return null;

    const impersonatingUserId =
      typeof payload.impersonatingUserId === "string" ? payload.impersonatingUserId : undefined;

    return { userId, impersonatingUserId };
  } catch {
    return null;
  }
}

export async function createSession(userId: string) {
  const token = await signSessionPayload({ userId });
  await writeSessionCookie(token);
}

export async function setImpersonationSession(adminUserId: string, impersonatingUserId: string) {
  const token = await signSessionPayload({ userId: adminUserId, impersonatingUserId });
  await writeSessionCookie(token);
}

export async function clearImpersonationSession(adminUserId: string) {
  const token = await signSessionPayload({ userId: adminUserId });
  await writeSessionCookie(token);
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getRealSessionUserId(): Promise<string | null> {
  const payload = await readSessionPayload();
  return payload?.userId ?? null;
}

export async function getImpersonatingUserId(): Promise<string | null> {
  const payload = await readSessionPayload();
  return payload?.impersonatingUserId ?? null;
}

export async function getSessionUserId(): Promise<string | null> {
  const payload = await readSessionPayload();
  if (!payload) return null;
  return payload.impersonatingUserId ?? payload.userId;
}

async function loadUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      agentTokens: {
        where: { revokedAt: null },
        orderBy: { createdAt: "desc" },
      },
      agentDevices: { orderBy: { lastSeenAt: "desc" } },
    },
  });
}

export async function getRealCurrentUser() {
  const userId = await getRealSessionUserId();
  if (!userId) return null;
  return loadUserById(userId);
}

export async function getCurrentUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return loadUserById(userId);
}

export async function getImpersonationContext() {
  const impersonatingUserId = await getImpersonatingUserId();
  if (!impersonatingUserId) return null;

  const user = await prisma.user.findUnique({
    where: { id: impersonatingUserId },
    select: { id: true, email: true, name: true },
  });
  return user;
}

export function generateAgentToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function createAgentTokenRecord(
  userId: string,
  plainToken: string,
  opts?: { label?: string; issuedById?: string | null },
) {
  const config = await getAppConfig();
  const tokenHash = await hashPassword(plainToken);
  const tokenPrefix = plainToken.slice(0, 8);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.pendingTokenTtlDays);

  return prisma.agentToken.create({
    data: {
      userId,
      tokenHash,
      tokenPrefix,
      label: opts?.label?.trim() || null,
      issuedById: opts?.issuedById ?? null,
      pendingTokenEnc: encryptPendingToken(plainToken),
      expiresAt,
    },
  });
}

/** Issue a new install token (admin or first-time setup). Plain token returned once. */
export async function issueAgentToken(
  userId: string,
  opts?: { label?: string; issuedById?: string | null },
) {
  await clearAgentDeregistration(userId);
  const plainToken = generateAgentToken();
  const record = await createAgentTokenRecord(userId, plainToken, opts);
  return { record, plainToken };
}

/** Ensure user has at least one active token; create only if none exist. */
export async function ensureAgentToken(userId: string) {
  const existing = await prisma.agentToken.findFirst({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { record: existing, plainToken: null as string | null };

  const plainToken = generateAgentToken();
  const record = await createAgentTokenRecord(userId, plainToken);
  return { record, plainToken };
}

/** Revoke all active tokens and issue one fresh token (admin-only flow). */
export async function regenerateAgentToken(userId: string) {
  await prisma.agentToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), pendingTokenEnc: null },
  });
  return issueAgentToken(userId);
}

export async function revokeAgentToken(tokenId: string) {
  const token = await prisma.agentToken.findUnique({ where: { id: tokenId } });
  if (!token || token.revokedAt) return null;
  return prisma.agentToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date(), pendingTokenEnc: null },
  });
}

/** Revoke a pending token and issue a replacement with the same label. */
export async function reissueAgentToken(
  tokenId: string,
  opts?: { issuedById?: string | null },
) {
  const old = await prisma.agentToken.findUnique({ where: { id: tokenId } });
  if (!old || old.revokedAt) {
    throw new Error("Token not found");
  }
  if (old.boundSerialNumber) {
    throw new Error("Cannot reissue a token already bound to a laptop");
  }

  await prisma.agentToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date(), pendingTokenEnc: null },
  });

  return issueAgentToken(old.userId, {
    label: old.label ?? undefined,
    issuedById: opts?.issuedById ?? old.issuedById,
  });
}

export function revealStoredPendingToken(
  token: {
    pendingTokenEnc: string | null;
    boundSerialNumber: string | null;
    revokedAt: Date | null;
    expiresAt?: Date | null;
  },
) {
  if (token.revokedAt || !token.pendingTokenEnc) return null;
  if (
    !token.boundSerialNumber &&
    isTokenExpired({
      revokedAt: token.revokedAt,
      boundSerialNumber: token.boundSerialNumber,
      expiresAt: token.expiresAt ?? null,
    })
  ) {
    return null;
  }
  return decryptPendingToken(token.pendingTokenEnc);
}

export type UserInstallTokenState = {
  installTokens: InstallTokenForUser[];
  legacyBoundCount: number;
};

export async function getUserInstallTokenState(
  userId: string,
  appUrl: string,
): Promise<UserInstallTokenState> {
  await revokeExpiredPendingTokens();

  const tokens = await prisma.agentToken.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "asc" },
  });

  const installTokens = tokens
    .map((t) => {
      const plain = revealStoredPendingToken(t);
      if (!plain) return null;
      const status: "pending" | "bound" = t.boundSerialNumber ? "bound" : "pending";
      return {
        id: t.id,
        label: t.label,
        prefix: t.tokenPrefix,
        plainToken: plain,
        installCommand: buildInstallCommand(appUrl, plain),
        updateCommand: buildUpdateCommand(appUrl, plain),
        createdAt: t.createdAt.toISOString(),
        status,
        boundSerialNumber: t.boundSerialNumber,
      };
    })
    .filter((t): t is InstallTokenForUser => t !== null);

  const legacyBoundCount = tokens.filter(
    (t) => t.boundSerialNumber && !revealStoredPendingToken(t),
  ).length;

  return { installTokens, legacyBoundCount };
}

export async function getInstallTokensForUser(
  userId: string,
  appUrl: string,
): Promise<InstallTokenForUser[]> {
  const state = await getUserInstallTokenState(userId, appUrl);
  return state.installTokens;
}

export async function getPendingInstallTokensForUser(userId: string, appUrl: string) {
  const all = await getInstallTokensForUser(userId, appUrl);
  return all.filter((t) => t.status === "pending");
}

export async function resolveAgentTokenRecord(token: string) {
  if (token.length < 16) return null;

  await revokeExpiredPendingTokens();

  const tokenPrefix = token.slice(0, 8);
  const agentToken = await prisma.agentToken.findUnique({
    where: { tokenPrefix },
    include: { user: { include: { agentDevices: true } } },
  });

  if (!agentToken || agentToken.revokedAt) return null;
  if (isTokenExpired(agentToken)) return null;

  const valid = await verifyPassword(token, agentToken.tokenHash);
  if (!valid) return null;

  return agentToken;
}

export async function getUserByAgentToken(token: string) {
  const agentToken = await resolveAgentTokenRecord(token);
  return agentToken?.user ?? null;
}

async function resolveRole(email: string) {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  if (adminEmail && email.toLowerCase() === adminEmail) return "admin";

  const userCount = await prisma.user.count();
  if (userCount === 0) return "admin";

  return "user";
}

/** Blocks the legacy /register password form only. OTP self-registration uses allowOtpSelfRegistration. */
export function isRegistrationEnvLocked() {
  return process.env.ALLOW_REGISTRATION === "false";
}

export function canSetInitialPassword(user: {
  email: string;
  registrationSource: string;
  passwordChosenAt: Date | null;
}): boolean {
  if (isBreakglassEmail(user.email)) return false;
  return user.registrationSource === "otp_self" && user.passwordChosenAt === null;
}

export async function setInitialUserPassword(userId: string, newPassword: string) {
  const { validatePasswordStrength, getSelfPasswordChangeBlockReason } = await import(
    "./password-policy"
  );

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }

  const blockReason = getSelfPasswordChangeBlockReason(user.email);
  if (blockReason) {
    throw new Error(blockReason);
  }

  if (!canSetInitialPassword(user)) {
    throw new Error("Use change password to update your password");
  }

  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) {
    throw new Error(strengthError);
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      passwordChosenAt: new Date(),
      mustChangePassword: false,
      passwordResetAt: null,
    },
  });
}

export async function isRegistrationAllowed() {
  if (isRegistrationEnvLocked()) return false;
  const config = await ensureAppConfig();
  return config.allowRegistration;
}

export async function createUserByAdmin(params: {
  email: string;
  password: string;
  name?: string;
  issueToken?: boolean;
  issuedById?: string;
}) {
  const normalizedEmail = params.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new Error("User already exists");
  }

  await ensureAppConfig();
  const passwordHash = await hashPassword(params.password);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: params.name?.trim() || null,
      role: "user",
      registrationSource: "admin",
    },
  });

  let plainAgentToken: string | null = null;
  if (params.issueToken !== false) {
    const issued = await issueAgentToken(user.id, {
      label: "Initial laptop",
      issuedById: params.issuedById ?? null,
    });
    plainAgentToken = issued.plainToken;
  }

  return { user, plainAgentToken };
}

export async function registerUser(email: string, password: string, name?: string) {
  if (!(await isRegistrationAllowed())) {
    throw new Error("Registration is disabled");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const role = await resolveRole(normalizedEmail);
  await ensureAppConfig();

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: name?.trim() || null,
      role,
    },
  });

  const { plainToken } = await issueAgentToken(user.id, { label: "Initial laptop" });
  return { user, plainAgentToken: plainToken };
}

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (!user) return null;
  const valid = await verifyPassword(password, user.passwordHash);
  return valid ? user : null;
}

export function maskAgentToken(prefix: string) {
  return `${prefix}${"•".repeat(56)}`;
}

export function summarizeAgentTokens(
  tokens: Array<{
    id: string;
    tokenPrefix: string;
    label: string | null;
    boundSerialNumber: string | null;
    revokedAt: Date | null;
    pendingTokenEnc: string | null;
    expiresAt: Date | null;
    createdAt: Date;
    lastUsedAt: Date | null;
  }>,
) {
  return tokens
    .filter((t) => !t.revokedAt)
    .map((t) => {
      let status: "bound" | "pending" | "expired";
      if (t.boundSerialNumber) {
        status = "bound";
      } else if (isTokenExpired(t)) {
        status = "expired";
      } else {
        status = "pending";
      }
      return {
        id: t.id,
        prefix: t.tokenPrefix,
        label: t.label,
        boundSerialNumber: t.boundSerialNumber,
        status,
        shareable: (status === "pending" || status === "bound") && !!t.pendingTokenEnc,
        expiresAt: t.expiresAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
      };
    });
}
