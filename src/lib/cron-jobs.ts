import { getAppConfig } from "./app-config";
import { logAuditEvent } from "./audit-log";
import { prisma } from "./db";
import { purgeOldHeartbeats } from "./heartbeat-retention";
import { syncOfficeSchedulesFromHistory } from "./office-schedule-sync";
import { dispatchPendingAlerts } from "./power-automate-notify";

export const CRON_JOBS = [
  {
    name: "agent-alerts",
    label: "Agent alerts",
    path: "/api/cron/agent-alerts",
    schedule: "0 10 * * *",
    scheduleUtc: "Daily at 10:00 UTC",
    scheduleIst: "Daily at 15:30 IST",
    purpose:
      "Sends eligible Office Pulse alerts through Power Automate. Vercel Hobby only allows one run per day. In-office hours_started and hours_met alerts also send from agent heartbeats.",
    expectedIntervalMs: 24 * 60 * 60 * 1000,
    healthyWithinMs: 2 * 24 * 60 * 60 * 1000,
  },
  {
    name: "purge-heartbeats",
    label: "Purge heartbeats",
    path: "/api/cron/purge-heartbeats",
    schedule: "15 0 * * *",
    scheduleUtc: "Daily at 00:15 UTC",
    scheduleIst: "Daily at 05:45 IST",
    purpose: "Deletes raw heartbeats older than the configured retention window. Visits are kept.",
    expectedIntervalMs: 24 * 60 * 60 * 1000,
    healthyWithinMs: 2 * 24 * 60 * 60 * 1000,
  },
  {
    name: "office-schedule",
    label: "Office schedule sync",
    path: "/api/cron/office-schedule",
    schedule: "30 16 * * 0",
    scheduleUtc: "Sunday at 16:30 UTC",
    scheduleIst: "Sunday at 22:00 IST",
    purpose: "Infers office schedules from visit history for users who have not set a custom schedule.",
    expectedIntervalMs: 7 * 24 * 60 * 60 * 1000,
    healthyWithinMs: 8 * 24 * 60 * 60 * 1000,
  },
] as const;

export type CronJobName = (typeof CRON_JOBS)[number]["name"];
export type CronRunSource = "schedule" | "manual";

type CronResult = Record<string, unknown>;

export function isCronJobName(value: string): value is CronJobName {
  return CRON_JOBS.some((job) => job.name === value);
}

async function runJobLogic(jobName: CronJobName): Promise<CronResult> {
  if (jobName === "agent-alerts") {
    return dispatchPendingAlerts();
  }

  if (jobName === "purge-heartbeats") {
    const config = await getAppConfig();
    const result = await purgeOldHeartbeats(config.heartbeatRetentionDays);
    const breakglass = await prisma.user.findFirst({ where: { role: "admin" } });
    if (breakglass && result.deleted > 0) {
      await logAuditEvent({
        actorId: breakglass.id,
        action: "heartbeat_purge",
        details: { deleted: result.deleted, retentionDays: config.heartbeatRetentionDays },
      });
    }
    return { ok: true, ...result };
  }

  const result = await syncOfficeSchedulesFromHistory();
  return { ok: true, ...result };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function summarizeResult(result: CronResult): string {
  const entries = Object.entries(result).filter(([key]) => key !== "ok");
  if (entries.length === 0) return "Completed";
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(", ").slice(0, 500);
}

async function saveRun(data: {
  jobName: CronJobName;
  source: CronRunSource;
  status: "ok" | "error";
  startedAt: Date;
  finishedAt: Date;
  resultSummary?: string;
  error?: string;
}) {
  try {
    await prisma.cronJobRun.create({
      data: {
        ...data,
        durationMs: data.finishedAt.getTime() - data.startedAt.getTime(),
      },
    });
  } catch (error) {
    console.error("[cron] Failed to save run status", error);
  }
}

export async function runCronJob(jobName: CronJobName, source: CronRunSource) {
  const startedAt = new Date();
  try {
    const result = await runJobLogic(jobName);
    if (result.ok === false) {
      throw new Error(typeof result.error === "string" ? result.error : "Job returned an error");
    }
    const finishedAt = new Date();
    await saveRun({
      jobName,
      source,
      status: "ok",
      startedAt,
      finishedAt,
      resultSummary: summarizeResult(result),
    });
    return result;
  } catch (error) {
    const finishedAt = new Date();
    const message = errorMessage(error).slice(0, 500);
    await saveRun({
      jobName,
      source,
      status: "error",
      startedAt,
      finishedAt,
      error: message,
    });
    throw error;
  }
}

export function cronHealth(
  lastRun: { status: string; finishedAt: Date } | null,
  expectedIntervalMs: number,
  now = new Date(),
  healthyWithinMs = expectedIntervalMs * 2,
): "working" | "never" | "overdue" | "failed" {
  if (!lastRun) return "never";
  if (lastRun.status !== "ok") return "failed";
  return now.getTime() - lastRun.finishedAt.getTime() <= healthyWithinMs
    ? "working"
    : "overdue";
}

export async function listCronJobs(now = new Date()) {
  return Promise.all(
    CRON_JOBS.map(async (job) => {
      const lastRun = await prisma.cronJobRun.findFirst({
        where: { jobName: job.name },
        orderBy: { startedAt: "desc" },
      });
      return {
        ...job,
        health: cronHealth(lastRun, job.expectedIntervalMs, now, job.healthyWithinMs),
        lastRun: lastRun
          ? {
              source: lastRun.source,
              status: lastRun.status,
              startedAt: lastRun.startedAt.toISOString(),
              finishedAt: lastRun.finishedAt.toISOString(),
              durationMs: lastRun.durationMs,
              resultSummary: lastRun.resultSummary,
              error: lastRun.error,
            }
          : null,
      };
    }),
  );
}
