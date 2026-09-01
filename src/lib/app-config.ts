import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { DEFAULT_HOURS_TARGET, DEFAULT_MONTHLY_DAYS_TARGET, parseDefaultSsidsFromEnv } from "./constants";

export const DEFAULT_PENDING_TOKEN_TTL_DAYS = 7;
export const DEFAULT_HEARTBEAT_RETENTION_DAYS = 7;
export const DEFAULT_AGENT_STALE_MINUTES = 8;

export function logAppConfigSchemaDriftIfNeeded(err: unknown): boolean {
  const isMissingColumn =
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2022" &&
    String(err.message).includes("allowRegistration");

  if (!isMissingColumn) return false;

  console.error(
    "[app-config] Database schema is behind the app (missing AppConfig.allowRegistration).\n" +
      "Fix now — Neon SQL Editor (fastest, no redeploy):\n" +
      '  ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "allowRegistration" BOOLEAN NOT NULL DEFAULT false;\n' +
      "Or redeploy with RUN_DB_SETUP_ON_DEPLOY=true on Vercel. Startup also auto-adds this column when missing."
  );
  return true;
}

export type AppConfigData = {
  hoursTarget: number;
  monthlyDaysTarget: number;
  officeSsids: string[];
  maxDevicesPerUser: number;
  allowRegistration: boolean;
  pendingTokenTtlDays: number;
  heartbeatRetentionDays: number;
  agentStaleMinutes: number;
};

const CONFIG_ID = "global";

export async function ensureAppConfig(): Promise<AppConfigData> {
  try {
    let config = await prisma.appConfig.findUnique({ where: { id: CONFIG_ID } });
    if (!config) {
      config = await prisma.appConfig.create({
        data: {
          id: CONFIG_ID,
          hoursTarget: DEFAULT_HOURS_TARGET,
          monthlyDaysTarget: DEFAULT_MONTHLY_DAYS_TARGET,
          officeSsids: JSON.stringify(parseDefaultSsidsFromEnv()),
          maxDevicesPerUser: 10,
          allowRegistration: false,
          pendingTokenTtlDays: DEFAULT_PENDING_TOKEN_TTL_DAYS,
          heartbeatRetentionDays: DEFAULT_HEARTBEAT_RETENTION_DAYS,
          agentStaleMinutes: DEFAULT_AGENT_STALE_MINUTES,
        },
      });
    }
    return parseConfig(config);
  } catch (err) {
    logAppConfigSchemaDriftIfNeeded(err);
    throw err;
  }
}

export async function getAppConfig(): Promise<AppConfigData> {
  return ensureAppConfig();
}

export async function updateAppConfig(data: Partial<AppConfigData>) {
  await ensureAppConfig();
  const update: Record<string, unknown> = {};
  if (data.hoursTarget !== undefined) update.hoursTarget = data.hoursTarget;
  if (data.monthlyDaysTarget !== undefined) update.monthlyDaysTarget = data.monthlyDaysTarget;
  if (data.officeSsids !== undefined) update.officeSsids = JSON.stringify(data.officeSsids);
  if (data.maxDevicesPerUser !== undefined) update.maxDevicesPerUser = data.maxDevicesPerUser;
  if (data.allowRegistration !== undefined) update.allowRegistration = data.allowRegistration;
  if (data.pendingTokenTtlDays !== undefined) update.pendingTokenTtlDays = data.pendingTokenTtlDays;
  if (data.heartbeatRetentionDays !== undefined) update.heartbeatRetentionDays = data.heartbeatRetentionDays;
  if (data.agentStaleMinutes !== undefined) update.agentStaleMinutes = data.agentStaleMinutes;

  const config = await prisma.appConfig.update({
    where: { id: CONFIG_ID },
    data: update,
  });
  return parseConfig(config);
}

export async function getUserHoursTarget(user: { hoursTarget: number | null }) {
  const global = await getAppConfig();
  return user.hoursTarget ?? global.hoursTarget;
}

export async function getAgentStaleMs() {
  const config = await getAppConfig();
  return config.agentStaleMinutes * 60 * 1000;
}

function parseConfig(config: {
  hoursTarget: number;
  monthlyDaysTarget?: number;
  officeSsids: string;
  maxDevicesPerUser: number;
  allowRegistration: boolean;
  pendingTokenTtlDays?: number;
  heartbeatRetentionDays?: number;
  agentStaleMinutes?: number;
}): AppConfigData {
  let ssids: string[] = parseDefaultSsidsFromEnv();
  try {
    const parsed = JSON.parse(config.officeSsids);
    if (Array.isArray(parsed)) ssids = parsed;
  } catch {
    /* use default */
  }
  return {
    hoursTarget: config.hoursTarget,
    monthlyDaysTarget: config.monthlyDaysTarget ?? DEFAULT_MONTHLY_DAYS_TARGET,
    officeSsids: ssids,
    maxDevicesPerUser: config.maxDevicesPerUser,
    allowRegistration: config.allowRegistration,
    pendingTokenTtlDays: config.pendingTokenTtlDays ?? DEFAULT_PENDING_TOKEN_TTL_DAYS,
    heartbeatRetentionDays: config.heartbeatRetentionDays ?? DEFAULT_HEARTBEAT_RETENTION_DAYS,
    agentStaleMinutes: config.agentStaleMinutes ?? DEFAULT_AGENT_STALE_MINUTES,
  };
}
