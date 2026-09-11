import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import {
  DEFAULT_HOURS_TARGET,
  DEFAULT_MONTHLY_DAYS_TARGET,
  parseDefaultSsidsFromEnv,
} from "./constants";
import {
  DEFAULT_FISCAL_YEAR_END_MONTH,
  DEFAULT_FISCAL_YEAR_START_MONTH,
  normalizeFiscalYearConfig,
} from "./fiscal-year";
import {
  backfillHeartbeatsAndVisitsAfterAllowlistChange,
  hasHeartbeatAllowlistMismatches,
} from "./ssid-backfill";

export const DEFAULT_PENDING_TOKEN_TTL_DAYS = 7;
export const DEFAULT_HEARTBEAT_RETENTION_DAYS = 7;
export const DEFAULT_HEARTBEAT_INTERVAL_MINUTES = 5;
export const DEFAULT_AGENT_STALE_MINUTES = 15;
export const DEFAULT_AGENT_STALE_GRACE_HOURS = 24;
export const DEFAULT_PILOT_START_MONTH_KEY = "2026-09";

export function resolveDefaultHeartbeatIntervalMinutes(): number {
  const parsed = Number(process.env.DEFAULT_HEARTBEAT_INTERVAL_MINUTES);
  if (Number.isInteger(parsed) && parsed >= 2 && parsed <= 60) return parsed;
  return DEFAULT_HEARTBEAT_INTERVAL_MINUTES;
}

export function resolvePilotStartMonthKey(stored?: string | null): string {
  const fromEnv = process.env.PILOT_START_MONTH?.trim();
  if (fromEnv && /^\d{4}-\d{2}$/.test(fromEnv)) {
    const month = Number(fromEnv.slice(5, 7));
    if (month >= 1 && month <= 12) return fromEnv;
  }
  if (stored && /^\d{4}-\d{2}$/.test(stored)) {
    const month = Number(stored.slice(5, 7));
    if (month >= 1 && month <= 12) return stored;
  }
  return DEFAULT_PILOT_START_MONTH_KEY;
}

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

/** Neon rejects every connection (P1010) when the role, password, or project is no longer valid. */
export function logDatabaseAccessDeniedIfNeeded(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const isAccessDenied =
    message.includes("User was denied access on the database") || message.includes("P1010");

  if (!isAccessDenied) return false;

  console.error(
    "[startup] Postgres refused the connection (access denied for the configured role).\n" +
      "  The app cannot read or write anything until this is fixed, so every page will fail.\n" +
      "  Check Vercel -> Storage -> Postgres (or the Neon dashboard) for a suspended or\n" +
      "  over-quota project, then copy fresh POSTGRES_PRISMA_URL and POSTGRES_URL_NON_POOLING\n" +
      "  values into .env.vercel.local and restart the dev server."
  );
  return true;
}

export type AppConfigData = {
  hoursTarget: number;
  monthlyDaysTarget: number;
  officeSsids: string[];
  maxDevicesPerUser: number;
  allowRegistration: boolean;
  allowOtpSelfRegistration: boolean;
  pendingTokenTtlDays: number;
  heartbeatRetentionDays: number;
  heartbeatIntervalMinutes: number;
  agentStaleMinutes: number;
  agentStaleGraceHours: number;
  complianceExemptionRequiresApproval: boolean;
  pilotStartMonthKey: string;
  fiscalYearStartMonth: number;
  fiscalYearEndMonth: number;
};

const CONFIG_ID = "global";
let allowlistReconciliationChecked = false;

async function reconcileHeartbeatsWithAllowlist(parsed: AppConfigData) {
  if (allowlistReconciliationChecked) return;
  allowlistReconciliationChecked = true;

  const mismatched = await hasHeartbeatAllowlistMismatches(
    parsed.officeSsids,
    parsed.heartbeatRetentionDays,
  );
  if (mismatched) {
    await backfillHeartbeatsAndVisitsAfterAllowlistChange(parsed.officeSsids);
  }
}

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
          allowOtpSelfRegistration: true,
          pendingTokenTtlDays: DEFAULT_PENDING_TOKEN_TTL_DAYS,
          heartbeatRetentionDays: DEFAULT_HEARTBEAT_RETENTION_DAYS,
          heartbeatIntervalMinutes: resolveDefaultHeartbeatIntervalMinutes(),
          agentStaleMinutes: DEFAULT_AGENT_STALE_MINUTES,
          agentStaleGraceHours: DEFAULT_AGENT_STALE_GRACE_HOURS,
          complianceExemptionRequiresApproval: true,
          pilotStartMonthKey: resolvePilotStartMonthKey(),
          fiscalYearStartMonth: DEFAULT_FISCAL_YEAR_START_MONTH,
          fiscalYearEndMonth: DEFAULT_FISCAL_YEAR_END_MONTH,
        },
      });
    } else {
      // DEFAULT_OFFICE_SSIDS seeds a new config only. Re-adding env defaults here would
      // silently undo an SSID the admin removed in /admin/settings.
      await reconcileHeartbeatsWithAllowlist(parseConfig(config));
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
  if (data.allowOtpSelfRegistration !== undefined) {
    update.allowOtpSelfRegistration = data.allowOtpSelfRegistration;
  }
  if (data.pendingTokenTtlDays !== undefined) update.pendingTokenTtlDays = data.pendingTokenTtlDays;
  if (data.heartbeatRetentionDays !== undefined) update.heartbeatRetentionDays = data.heartbeatRetentionDays;
  if (data.heartbeatIntervalMinutes !== undefined) {
    update.heartbeatIntervalMinutes = data.heartbeatIntervalMinutes;
  }
  if (data.agentStaleMinutes !== undefined) update.agentStaleMinutes = data.agentStaleMinutes;
  if (data.agentStaleGraceHours !== undefined) update.agentStaleGraceHours = data.agentStaleGraceHours;
  if (data.complianceExemptionRequiresApproval !== undefined) {
    update.complianceExemptionRequiresApproval = data.complianceExemptionRequiresApproval;
  }
  if (data.pilotStartMonthKey !== undefined) update.pilotStartMonthKey = data.pilotStartMonthKey;
  if (data.fiscalYearStartMonth !== undefined) update.fiscalYearStartMonth = data.fiscalYearStartMonth;
  if (data.fiscalYearEndMonth !== undefined) update.fiscalYearEndMonth = data.fiscalYearEndMonth;

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

export async function getEffectiveAgentStaleGraceHours(user: {
  agentStaleGraceHours: number | null;
}) {
  const global = await getAppConfig();
  return user.agentStaleGraceHours ?? global.agentStaleGraceHours;
}

export function agentHealthGraceMs(graceHours: number) {
  return graceHours * 60 * 60 * 1000;
}

function parseConfig(config: {
  hoursTarget: number;
  monthlyDaysTarget?: number;
  officeSsids: string;
  maxDevicesPerUser: number;
  allowRegistration: boolean;
  allowOtpSelfRegistration?: boolean;
  pendingTokenTtlDays?: number;
  heartbeatRetentionDays?: number;
  heartbeatIntervalMinutes?: number;
  agentStaleMinutes?: number;
  agentStaleGraceHours?: number;
  complianceExemptionRequiresApproval?: boolean;
  pilotStartMonthKey?: string;
  fiscalYearStartMonth?: number;
  fiscalYearEndMonth?: number;
}): AppConfigData {
  let ssids: string[] = parseDefaultSsidsFromEnv();
  try {
    const parsed = JSON.parse(config.officeSsids);
    if (Array.isArray(parsed)) ssids = parsed;
  } catch {
    /* use default */
  }
  const fiscalYear = normalizeFiscalYearConfig({
    startMonth: config.fiscalYearStartMonth,
    endMonth: config.fiscalYearEndMonth,
  });
  return {
    hoursTarget: config.hoursTarget,
    monthlyDaysTarget: config.monthlyDaysTarget ?? DEFAULT_MONTHLY_DAYS_TARGET,
    officeSsids: ssids,
    maxDevicesPerUser: config.maxDevicesPerUser,
    allowRegistration: config.allowRegistration,
    allowOtpSelfRegistration: config.allowOtpSelfRegistration ?? true,
    pendingTokenTtlDays: config.pendingTokenTtlDays ?? DEFAULT_PENDING_TOKEN_TTL_DAYS,
    heartbeatRetentionDays: config.heartbeatRetentionDays ?? DEFAULT_HEARTBEAT_RETENTION_DAYS,
    heartbeatIntervalMinutes:
      config.heartbeatIntervalMinutes ?? resolveDefaultHeartbeatIntervalMinutes(),
    agentStaleMinutes: config.agentStaleMinutes ?? DEFAULT_AGENT_STALE_MINUTES,
    agentStaleGraceHours: config.agentStaleGraceHours ?? DEFAULT_AGENT_STALE_GRACE_HOURS,
    complianceExemptionRequiresApproval: config.complianceExemptionRequiresApproval ?? true,
    pilotStartMonthKey: resolvePilotStartMonthKey(config.pilotStartMonthKey),
    fiscalYearStartMonth: fiscalYear.startMonth,
    fiscalYearEndMonth: fiscalYear.endMonth,
  };
}

export function fiscalYearConfigFromApp(config: AppConfigData) {
  return normalizeFiscalYearConfig({
    startMonth: config.fiscalYearStartMonth,
    endMonth: config.fiscalYearEndMonth,
  });
}
