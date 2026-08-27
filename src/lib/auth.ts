import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { ensureAppConfig } from "./app-config";
import crypto from "crypto";

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
      agentToken: true,
      agentDevices: { orderBy: { lastSeenAt: "desc" } },
    },
  });
}

export function generateAgentToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function createAgentTokenRecord(userId: string, plainToken: string) {
  const tokenHash = await hashPassword(plainToken);
  const tokenPrefix = plainToken.slice(0, 8);
  return prisma.agentToken.create({
    data: { userId, tokenHash, tokenPrefix },
  });
}

export async function ensureAgentToken(userId: string) {
  const existing = await prisma.agentToken.findUnique({ where: { userId } });
  if (existing) return { record: existing, plainToken: null as string | null };

  const plainToken = generateAgentToken();
  const record = await createAgentTokenRecord(userId, plainToken);
  return { record, plainToken };
}

export async function regenerateAgentToken(userId: string) {
  const plainToken = generateAgentToken();
  const tokenHash = await hashPassword(plainToken);
  const tokenPrefix = plainToken.slice(0, 8);

  const record = await prisma.agentToken.upsert({
    where: { userId },
    create: { userId, tokenHash, tokenPrefix },
    update: { tokenHash, tokenPrefix },
  });

  return { record, plainToken };
}

export async function getUserByAgentToken(token: string) {
  if (token.length < 16) return null;

  const tokenPrefix = token.slice(0, 8);
  const agentToken = await prisma.agentToken.findUnique({
    where: { tokenPrefix },
    include: { user: { include: { agentDevices: true } } },
  });

  if (!agentToken) return null;

  const valid = await verifyPassword(token, agentToken.tokenHash);
  if (!valid) return null;

  return agentToken.user;
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

  const plainToken = generateAgentToken();
  await createAgentTokenRecord(user.id, plainToken);
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
