/**
 * Read-only check that the notification delivery-channel columns and the
 * InAppNotification table exist in the connected Postgres database.
 * Run: node scripts/check-notification-schema.mjs
 */

import { loadEnvFiles } from "./load-env-files.mjs";
import { resolvePostgresEnv } from "./resolve-postgres-env.mjs";

const loaded = loadEnvFiles();
const { prismaUrl, directUrl } = resolvePostgresEnv();

console.log(`Env files loaded: ${loaded.join(", ") || "(none)"}`);
console.log(`Pooled URL present: ${Boolean(prismaUrl)}`);
console.log(`Direct URL present: ${Boolean(directUrl)}`);

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const EXPECTED_COLUMNS = [
  "channelNotInOffice",
  "channelAgentStale",
  "channelBehindHours",
  "channelHoursStarted",
  "channelHoursMet",
];

try {
  const columns = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'UserNotificationPrefs'`
  );
  const names = new Set(columns.map((row) => row.column_name));
  for (const column of EXPECTED_COLUMNS) {
    console.log(`UserNotificationPrefs.${column}: ${names.has(column) ? "present" : "MISSING"}`);
  }

  const tables = await prisma.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'InAppNotification'`
  );
  console.log(`InAppNotification table: ${tables.length > 0 ? "present" : "MISSING"}`);
} catch (error) {
  console.error(`Database check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
