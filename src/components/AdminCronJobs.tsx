"use client";

import { useState } from "react";

type CronJob = {
  name: string;
  label: string;
  path: string;
  schedule: string;
  scheduleUtc: string;
  scheduleIst: string;
  purpose: string;
  health: "working" | "never" | "overdue" | "failed";
  lastRun: {
    source: string;
    status: string;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    resultSummary: string | null;
    error: string | null;
  } | null;
};

const HEALTH_LABELS: Record<CronJob["health"], string> = {
  working: "Working",
  never: "Never run",
  overdue: "Overdue",
  failed: "Failed",
};

function formatRunTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function AdminCronJobs({ initialJobs }: { initialJobs: CronJob[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshJobs() {
    const response = await fetch("/api/admin/cron", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { jobs: CronJob[] };
    setJobs(data.jobs);
  }

  async function runNow(job: CronJob) {
    setRunning(job.name);
    setMessage(null);
    const response = await fetch(`/api/admin/cron/${job.name}/run`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    await refreshJobs();
    setRunning(null);
    setMessage(
      response.ok
        ? `${job.label} completed.`
        : `${job.label} failed: ${data.error ?? "Unknown error"}`,
    );
  }

  return (
    <section className="card p-6">
      <h2 className="text-lg font-medium">Cron jobs</h2>
      <p className="mt-1 text-sm text-muted">
        Vercel calls these paths with a CRON_SECRET bearer token. Run now uses your admin session and
        never sends the secret to the browser.
      </p>
      <p className="mt-1 text-xs text-muted">
        Scheduled runs occur only in the deployed Vercel environment. Hobby plans reject cron
        expressions that would run more than once per day, so agent alerts are daily. Local
        development shows manual runs and any records in the connected database.
      </p>

      <div className="mt-5 space-y-4">
        {jobs.map((job) => {
          const healthColor =
            job.health === "working"
              ? "text-green-400"
              : job.health === "never"
                ? "text-muted"
                : "text-red-400";
          return (
            <article key={job.name} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{job.label}</h3>
                    <span className={`text-xs font-medium ${healthColor}`}>
                      {HEALTH_LABELS[job.health]}
                    </span>
                  </div>
                  <code className="text-xs text-muted">{job.path}</code>
                </div>
                <button
                  type="button"
                  onClick={() => runNow(job)}
                  disabled={running !== null}
                  className="btn-primary px-3 py-2 text-sm disabled:opacity-50"
                >
                  {running === job.name ? "Running..." : "Run now"}
                </button>
              </div>

              <p className="mt-3 text-sm">{job.purpose}</p>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <p>
                  <span className="text-muted">Schedule:</span> <code>{job.schedule}</code>
                </p>
                <p>
                  <span className="text-muted">UTC:</span> {job.scheduleUtc}
                </p>
                <p>
                  <span className="text-muted">IST:</span> {job.scheduleIst}
                </p>
                <p>
                  <span className="text-muted">Auth:</span> CRON_SECRET bearer
                </p>
              </div>

              {job.lastRun ? (
                <div className="mt-3 rounded-lg bg-black/10 p-3 text-xs">
                  <p>
                    <span className="text-muted">Last run:</span>{" "}
                    {formatRunTime(job.lastRun.finishedAt)} ({job.lastRun.source})
                  </p>
                  <p>
                    <span className="text-muted">Status:</span> {job.lastRun.status},{" "}
                    {job.lastRun.durationMs} ms
                  </p>
                  {job.lastRun.resultSummary && (
                    <p className="mt-1 break-words">
                      <span className="text-muted">Result:</span> {job.lastRun.resultSummary}
                    </p>
                  )}
                  {job.lastRun.error && (
                    <p className="mt-1 break-words text-red-400">
                      <span>Error:</span> {job.lastRun.error}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted">No run has been recorded yet.</p>
              )}
            </article>
          );
        })}
      </div>

      {message && <p className="mt-4 text-sm">{message}</p>}
    </section>
  );
}
