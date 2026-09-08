import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";
import { dayKeyInTimezone } from "./notification-prefs";

const OOO_JWT_PURPOSE = "ooo";
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

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

export function assertValidDayKey(dayKey: string) {
  if (!DAY_KEY_RE.test(dayKey)) {
    throw new Error("Invalid dayKey");
  }
}

export function isDayKeyInRange(dayKey: string, startDate: string, endDate: string): boolean {
  return startDate <= dayKey && dayKey <= endDate;
}

/** True when two inclusive date-key ranges overlap. */
export function dateRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return startA <= endB && startB <= endA;
}

function addDaysToDayKey(dayKey: string, delta: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export async function isUserOutOfOffice(userId: string, dayKey: string): Promise<boolean> {
  assertValidDayKey(dayKey);
  const row = await prisma.userOutOfOffice.findFirst({
    where: {
      userId,
      startDate: { lte: dayKey },
      endDate: { gte: dayKey },
    },
  });
  return row !== null;
}

export async function isUserOutOfOfficeNow(userId: string, timezone: string): Promise<boolean> {
  const todayKey = dayKeyInTimezone(new Date(), timezone);
  return isUserOutOfOffice(userId, todayKey);
}

export async function addOutOfOfficeRange(
  userId: string,
  startDate: string,
  endDate: string,
  source: "settings" | "link" | "admin" = "settings",
) {
  assertValidDayKey(startDate);
  assertValidDayKey(endDate);
  if (endDate < startDate) {
    throw new Error("endDate must be on or after startDate");
  }

  const overlapping = await prisma.userOutOfOffice.findMany({
    where: {
      userId,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    orderBy: { startDate: "asc" },
  });

  if (overlapping.length === 0) {
    return prisma.userOutOfOffice.create({
      data: { userId, startDate, endDate, source },
    });
  }

  let mergedStart = startDate;
  let mergedEnd = endDate;
  let mergedSource = source;
  for (const row of overlapping) {
    if (row.startDate < mergedStart) mergedStart = row.startDate;
    if (row.endDate > mergedEnd) mergedEnd = row.endDate;
    if (row.source === "admin") mergedSource = "admin";
  }

  await prisma.userOutOfOffice.deleteMany({
    where: { id: { in: overlapping.map((r) => r.id) } },
  });

  return prisma.userOutOfOffice.create({
    data: { userId, startDate: mergedStart, endDate: mergedEnd, source: mergedSource },
  });
}

export async function markUserOutOfOffice(
  userId: string,
  dayKey: string,
  source: "settings" | "link" | "admin" = "settings",
) {
  return addOutOfOfficeRange(userId, dayKey, dayKey, source);
}

export async function removeOutOfOfficeRange(userId: string, rangeId: string) {
  await prisma.userOutOfOffice.deleteMany({
    where: { id: rangeId, userId },
  });
}

/** Clears OOO for the given calendar day when office presence is detected. */
export async function maybeClearOutOfOfficeOnOfficePresence(
  userId: string,
  timezone: string,
  at: Date = new Date(),
): Promise<{ cleared: boolean; dayKey: string }> {
  const dayKey = dayKeyInTimezone(at, timezone);
  if (!(await isUserOutOfOffice(userId, dayKey))) {
    return { cleared: false, dayKey };
  }
  await clearUserOutOfOffice(userId, dayKey);
  return { cleared: true, dayKey };
}

export async function clearUserOutOfOffice(userId: string, dayKey: string) {
  assertValidDayKey(dayKey);
  const covering = await prisma.userOutOfOffice.findMany({
    where: {
      userId,
      startDate: { lte: dayKey },
      endDate: { gte: dayKey },
    },
  });

  for (const row of covering) {
    if (row.startDate === row.endDate && row.startDate === dayKey) {
      await prisma.userOutOfOffice.delete({ where: { id: row.id } });
      continue;
    }

    await prisma.userOutOfOffice.delete({ where: { id: row.id } });

    if (row.startDate < dayKey) {
      await prisma.userOutOfOffice.create({
        data: {
          userId,
          startDate: row.startDate,
          endDate: addDaysToDayKey(dayKey, -1),
          source: row.source,
        },
      });
    }
    if (row.endDate > dayKey) {
      await prisma.userOutOfOffice.create({
        data: {
          userId,
          startDate: addDaysToDayKey(dayKey, 1),
          endDate: row.endDate,
          source: row.source,
        },
      });
    }
  }
}

export async function listUserOutOfOffice(userId: string, fromDayKey?: string) {
  const where = fromDayKey
    ? { userId, endDate: { gte: fromDayKey } }
    : { userId };
  return prisma.userOutOfOffice.findMany({
    where,
    orderBy: [{ startDate: "asc" }, { endDate: "asc" }],
    select: { id: true, startDate: true, endDate: true, source: true, createdAt: true },
  });
}

export async function getOutOfOfficeStatus(userId: string, timezone: string) {
  const todayKey = dayKeyInTimezone(new Date(), timezone);
  const ranges = await listUserOutOfOffice(userId, todayKey);
  const isOutToday = ranges.some((r) => isDayKeyInRange(todayKey, r.startDate, r.endDate));
  return { todayKey, isOutToday, ranges };
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
