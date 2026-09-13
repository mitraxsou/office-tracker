/**
 * Creates demo users with dashboard data for local or remote testing.
 *
 * Usage:
 *   npm run prisma:env -- tsx scripts/regression/seed-demo-users.ts
 *   OFFICETRACKER_ENV_PROFILE=prod npm run seed:demo:prod
 *
 * Writes tokens to .demo-users.local.json (gitignored) for the dev simulator.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { writeFileSync } from "fs";
import { resolve } from "path";
import { DEFAULT_OFFICE_SSIDS } from "../../src/lib/constants";
import { dayKeyInTimezone } from "../../src/lib/visits";

const DEMO_PASSWORD = "Demo-Users-2026!";
const TIMEZONE = "Asia/Kolkata";
const OFFICE_SSID = DEFAULT_OFFICE_SSIDS[0];

export const DEMO_USER_SPECS = [
  {
    email: "demo.admin@office-tracker.test",
    name: "Demo Admin",
    role: "admin" as const,
    serial: "DEMO-LAPTOP-ADMIN",
    pattern: "admin" as const,
  },
  {
    email: "demo.compliant@office-tracker.test",
    name: "Demo Compliant",
    role: "user" as const,
    serial: "DEMO-LAPTOP-01",
    pattern: "compliant" as const,
  },
  {
    email: "demo.partial@office-tracker.test",
    name: "Demo Partial",
    role: "user" as const,
    serial: "DEMO-LAPTOP-02",
    pattern: "partial" as const,
  },
  {
    email: "demo.behind@office-tracker.test",
    name: "Demo Behind",
    role: "user" as const,
    serial: "DEMO-LAPTOP-03",
    pattern: "behind" as const,
  },
  {
    email: "demo.traveler@office-tracker.test",
    name: "Demo Traveler",
    role: "user" as const,
    serial: "DEMO-LAPTOP-04",
    pattern: "traveler" as const,
  },
];

const prisma = new PrismaClient();

type SeedPattern = (typeof DEMO_USER_SPECS)[number]["pattern"];

async function purgeDemoUserData(userId: string) {
  await prisma.agentApiHitDaily.deleteMany({ where: { userId } });
  await prisma.agentEvent.deleteMany({ where: { userId } });
  await prisma.activityTick.deleteMany({ where: { userId } });
  await prisma.presenceTransition.deleteMany({ where: { userId } });
  await prisma.dailySummary.deleteMany({ where: { userId } });
  await prisma.visit.deleteMany({ where: { userId } });
  await prisma.heartbeat.deleteMany({ where: { userId } });
  await prisma.agentLifecycleEvent.deleteMany({ where: { userId } });
  await prisma.agentDevice.deleteMany({ where: { userId } });
  await prisma.agentToken.deleteMany({ where: { userId } });
}

function officeHoursForPattern(pattern: SeedPattern, dayIndex: number): number {
  switch (pattern) {
    case "admin":
    case "compliant":
      return dayIndex % 7 === 0 ? 0 : 5.5 + (dayIndex % 3) * 0.25;
    case "partial":
      return dayIndex % 7 === 0 ? 0 : 2.5 + (dayIndex % 4) * 0.5;
    case "behind":
      return dayIndex % 7 === 0 ? 0 : 1 + (dayIndex % 5) * 0.4;
    case "traveler":
      return dayIndex % 7 === 0 ? 0 : dayIndex % 2 === 0 ? 6 : 3;
  }
}

function ssidForPattern(pattern: SeedPattern, dayIndex: number): string {
  if (pattern === "traveler" && dayIndex % 2 === 1) {
    return DEFAULT_OFFICE_SSIDS[1];
  }
  return OFFICE_SSID;
}

function istDayStart(dayKey: string): Date {
  return new Date(`${dayKey}T03:30:00.000Z`);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function recentWeekdayKeys(count: number): string[] {
  const keys: string[] = [];
  const cursor = new Date();
  while (keys.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      keys.push(dayKeyInTimezone(cursor, TIMEZONE));
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return keys.reverse();
}

async function seedDashboardData(params: {
  userId: string;
  deviceId: string;
  pattern: SeedPattern;
}) {
  const dayKeys = recentWeekdayKeys(12);
  for (let index = 0; index < dayKeys.length; index++) {
    const dayKey = dayKeys[index];
    const hours = officeHoursForPattern(params.pattern, index);
    if (hours <= 0) continue;

    const ssid = ssidForPattern(params.pattern, index);
    const startAt = addHours(istDayStart(dayKey), 9.5);
    const endAt = addHours(startAt, hours);
    const officeMs = Math.round(hours * 60 * 60 * 1000);
    const localVisitId = crypto.randomUUID();

    const visit = await prisma.visit.create({
      data: {
        userId: params.userId,
        deviceId: params.deviceId,
        startAt,
        endAt,
        source: "wifi",
        ssid,
        localVisitId,
      },
    });

    await prisma.presenceTransition.create({
      data: {
        userId: params.userId,
        deviceId: params.deviceId,
        type: "visit_start",
        at: startAt,
        dayKey,
        ssid,
        inOffice: true,
      },
    });

    await prisma.presenceTransition.create({
      data: {
        userId: params.userId,
        deviceId: params.deviceId,
        type: "visit_end",
        at: endAt,
        dayKey,
        ssid,
        inOffice: true,
      },
    });

    const tickCount = Math.max(3, Math.floor(hours * 2));
    for (let tick = 0; tick < tickCount; tick++) {
      const tickAt = addHours(startAt, (tick / tickCount) * hours);
      await prisma.activityTick.create({
        data: {
          userId: params.userId,
          deviceId: params.deviceId,
          at: tickAt,
          ssid,
          inOffice: true,
        },
      });
    }

    await prisma.dailySummary.create({
      data: {
        userId: params.userId,
        dayKey,
        officeMs,
        laptopActiveMs: officeMs,
        visitCount: 1,
        firstCheckInAt: startAt,
        lastCheckOutAt: endAt,
        source: "agent",
        verified: true,
      },
    });

    await prisma.agentEvent.create({
      data: {
        userId: params.userId,
        deviceId: params.deviceId,
        clientEventId: crypto.randomUUID(),
        type: "visit_start",
        status: "accepted",
        payload: { localVisitId, visitId: visit.id },
      },
    });
  }
}

async function upsertDemoUser(spec: (typeof DEMO_USER_SPECS)[number]) {
  const email = spec.email.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    await purgeDemoUserData(user.id);
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: spec.name,
        role: spec.role,
        timezone: TIMEZONE,
      },
    });
    console.log(`Refreshed demo user ${email}`);
  } else {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: spec.name,
        role: spec.role,
        registrationSource: "admin",
        timezone: TIMEZONE,
        termsAcceptedAt: new Date(),
        termsAcceptedVersion: 1,
      },
    });
    console.log(`Created demo user ${email}`);
  }

  const plainToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = await bcrypt.hash(plainToken, 12);
  const tokenPrefix = plainToken.slice(0, 8);

  await prisma.agentToken.create({
    data: {
      userId: user.id,
      tokenHash,
      tokenPrefix,
      label: "demo simulator",
      boundSerialNumber: spec.serial,
    },
  });

  const device = await prisma.agentDevice.create({
    data: {
      userId: user.id,
      serialNumber: spec.serial,
      lastSeenAt: new Date(),
      agentScriptVersion: "1.3.2",
    },
  });

  if (spec.pattern !== "admin") {
    await seedDashboardData({
      userId: user.id,
      deviceId: device.id,
      pattern: spec.pattern,
    });
  } else {
    await seedDashboardData({
      userId: user.id,
      deviceId: device.id,
      pattern: "compliant",
    });
  }

  return {
    email,
    name: spec.name,
    role: spec.role,
    password: DEMO_PASSWORD,
    token: plainToken,
    serial: spec.serial,
    userId: user.id,
  };
}

async function main() {
  const users = [];
  for (const spec of DEMO_USER_SPECS) {
    users.push(await upsertDemoUser(spec));
  }

  const apiUrl =
    process.env.REGRESSION_API_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const payload = { apiUrl, users };
  const outPath = resolve(process.cwd(), ".demo-users.local.json");
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log("");
  console.log(`Wrote ${outPath}`);
  console.log(JSON.stringify(payload, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
