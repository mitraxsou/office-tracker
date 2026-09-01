import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";
import { dayKeyInTimezone } from "./notification-prefs";

const OOO_JWT_PURPOSE = "ooo";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://office-tracker-theta.vercel.app";
}

export async function isUserOutOfOffice(userId: string, dayKey: string): Promise<boolean> {
  const row = await prisma.userOutOfOffice.findUnique({
    where: { userId_dayKey: { userId, dayKey } },
  });
  return row !== null;
}

export async function markUserOutOfOffice(
  userId: string,
  dayKey: string,
  source: "settings" | "link" | "admin" = "settings",
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    throw new Error("Invalid dayKey");
  }
  return prisma.userOutOfOffice.upsert({
    where: { userId_dayKey: { userId, dayKey } },
    create: { userId, dayKey, source },
    update: { source },
  });
}

export async function clearUserOutOfOffice(userId: string, dayKey: string) {
  await prisma.userOutOfOffice.deleteMany({
    where: { userId, dayKey },
  });
}

export async function listUserOutOfOffice(userId: string, fromDayKey?: string) {
  const where = fromDayKey
    ? { userId, dayKey: { gte: fromDayKey } }
    : { userId };
  return prisma.userOutOfOffice.findMany({
    where,
    orderBy: { dayKey: "asc" },
    select: { dayKey: true, source: true, createdAt: true },
  });
}

export async function getOutOfOfficeStatus(userId: string, timezone: string) {
  const todayKey = dayKeyInTimezone(new Date(), timezone);
  const days = await listUserOutOfOffice(userId, todayKey);
  const isOutToday = days.some((d) => d.dayKey === todayKey);
  return { todayKey, isOutToday, days };
}

export async function createOutOfOfficeLinkToken(userId: string, dayKey: string) {
  return new SignJWT({ userId, dayKey, purpose: OOO_JWT_PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(getSecret());
}

export async function buildOutOfOfficeLinkUrl(userId: string, dayKey: string) {
  const token = await createOutOfOfficeLinkToken(userId, dayKey);
  return `${appBaseUrl()}/ooo?token=${encodeURIComponent(token)}`;
}

export async function redeemOutOfOfficeLinkToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret());
  if (payload.purpose !== OOO_JWT_PURPOSE) {
    throw new Error("Invalid token purpose");
  }
  const userId = payload.userId;
  const dayKey = payload.dayKey;
  if (typeof userId !== "string" || typeof dayKey !== "string") {
    throw new Error("Invalid token payload");
  }
  await markUserOutOfOffice(userId, dayKey, "link");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  return { userId, dayKey, email: user?.email ?? null, name: user?.name ?? null };
}
