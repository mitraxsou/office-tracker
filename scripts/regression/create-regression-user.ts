/**
 * Creates or refreshes the regression dummy user and agent token.
 * Only deletes data scoped to regression.dummy@office-tracker.test.
 *
 * Usage:
 *   npm run prisma:env -- tsx scripts/regression/create-regression-user.ts
 *
 * Requires POSTGRES_PRISMA_URL in .env.local (or Vercel Storage vars).
 * Uses whichever database that URL points at (dev Neon by default, not prod theta).
 * For production: npm run regression:create-prod (see docs/agent-regression-matrix.md).
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const REGRESSION_EMAIL = "regression.dummy@office-tracker.test";
export const REGRESSION_SERIAL = "REGRESSION-LAPTOP-01";
const REGRESSION_PASSWORD = "Regression-Only-2026!";

const prisma = new PrismaClient();

async function purgeRegressionUserData(userId: string) {
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

async function main() {
  const email = REGRESSION_EMAIL.toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    await purgeRegressionUserData(user.id);
    console.log(`Purged prior regression data for ${email}`);
  } else {
    const passwordHash = await bcrypt.hash(REGRESSION_PASSWORD, 12);
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: "Regression Dummy",
        role: "user",
        registrationSource: "admin",
        timezone: "Asia/Kolkata",
      },
    });
    console.log(`Created regression user ${email}`);
  }

  const plainToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = await bcrypt.hash(plainToken, 12);
  const tokenPrefix = plainToken.slice(0, 8);

  await prisma.agentToken.create({
    data: {
      userId: user.id,
      tokenHash,
      tokenPrefix,
      label: "regression harness",
    },
  });

  const payload = {
    userId: user.id,
    email,
    password: REGRESSION_PASSWORD,
    token: plainToken,
    serial: REGRESSION_SERIAL,
    apiUrl: process.env.REGRESSION_API_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  };

  console.log(JSON.stringify(payload, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
