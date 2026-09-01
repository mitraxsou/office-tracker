import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { ensureAppConfig, getAppConfig } from "./app-config";
import crypto from "crypto";
import { encryptPendingToken, decryptPendingToken } from "./token-crypto";
import { buildInstallCommand } from "./agent-branding";
import { isTokenExpired, revokeExpiredPendingTokens } from "./token-expiry";

const SESSION_COOKIE = "office-tracker-session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

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

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;
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
  if (token.revokedAt || token.boundSerialNumber || !token.pendingTokenEnc) return null;
  if (isTokenExpired({
    revokedAt: token.revokedAt,
    boundSerialNumber: token.boundSerialNumber,
    expiresAt: token.expiresAt ?? null,
  })) return null;
  return decryptPendingToken(token.pendingTokenEnc);
}

export async function getPendingInstallTokensForUser(userId: string, appUrl: string) {
  await revokeExpiredPendingTokens();

  const tokens = await prisma.agentToken.findMany({
    where: { userId, revokedAt: null, boundSerialNumber: null },
    orderBy: { createdAt: "desc" },
  });

  return tokens
    .map((t) => {
      const plain = revealStoredPendingToken(t);
      if (!plain) return null;
      return {
        id: t.id,
        label: t.label,
        prefix: t.tokenPrefix,
        plainToken: plain,
        installCommand: buildInstallCommand(appUrl, plain),
        createdAt: t.createdAt.toISOString(),
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);
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

export function isRegistrationEnvLocked() {
  return process.env.ALLOW_REGISTRATION === "false";
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
        shareable: status === "pending" && !!t.pendingTokenEnc,
        expiresAt: t.expiresAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
      };
    });
}
