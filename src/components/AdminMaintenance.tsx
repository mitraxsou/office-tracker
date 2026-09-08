"use client";

import { useState } from "react";
import {
  MAINTENANCE_TABLE_LABELS,
  NEVER_PURGED_TABLES,
  RETENTION_PERIOD_LABELS,
  type MaintenanceTable,
  type RetentionPeriod,
} from "@/lib/db-maintenance";

const TABLES = Object.keys(MAINTENANCE_TABLE_LABELS) as MaintenanceTable[];
const PERIODS = Object.keys(RETENTION_PERIOD_LABELS) as RetentionPeriod[];

export function AdminMaintenance() {
  const [table, setTable] = useState<MaintenanceTable>("heartbeats");
  const [period, setPeriod] = useState<RetentionPeriod>("1_month");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewCutoff, setPreviewCutoff] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handlePreview() {
    setPreviewLoading(true);
    setError(null);
    setSuccess(null);
    const res = await fetch(
      `/api/admin/maintenance/preview?table=${table}&period=${period}`,
    );
    setPreviewLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Preview failed");
      setPreviewCount(null);
      return;
    }
    const data = await res.json();
    setPreviewCount(data.count);
    setPreviewCutoff(data.cutoff);
  }

  async function handlePurge() {
    if (confirmText !== "DELETE") return;
    setPurgeLoading(true);
    setError(null);
    setSuccess(null);
    const res = await fetch("/api/admin/maintenance/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table, period, confirm: "DELETE" }),
    });
    setPurgeLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Purge failed");
      return;
    }
    const data = await res.json();
    setSuccess(`Deleted ${data.deleted} rows from ${MAINTENANCE_TABLE_LABELS[table]}.`);
    setConfirmText("");
    setPreviewCount(null);
    setPreviewCutoff(null);
  }

  return (
    <section className="card border border-red-500/30 p-6">
      <h2 className="mb-1 text-lg font-medium">Data maintenance</h2>
      <p className="mb-4 text-sm text-muted">
        Remove old operational data. Never purged: {NEVER_PURGED_TABLES.join(", ")} (visit logs are
        permanent compliance records). Power Automate webhook secrets are revoked in Admin, not
        deleted here. Use preview before purging.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-muted">Table</span>
          <select
            value={table}
            onChange={(e) => {
              setTable(e.target.value as MaintenanceTable);
              setPreviewCount(null);
            }}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2"
          >
            {TABLES.map((t) => (
              <option key={t} value={t}>
                {MAINTENANCE_TABLE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted">Older than</span>
          <select
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value as RetentionPeriod);
              setPreviewCount(null);
            }}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2"
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {RETENTION_PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={previewLoading}
          onClick={handlePreview}
          className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
        >
          {previewLoading ? "Counting..." : "Preview count"}
        </button>
      </div>

      {previewCount !== null && (
        <p className="mt-3 text-sm">
          <span className="font-medium text-accent">{previewCount}</span> rows would be deleted
          {previewCutoff
            ? ` (recorded before ${new Date(previewCutoff).toLocaleString("en-IN")})`
            : ""}
          .
        </p>
      )}

      <div className="mt-6 border-t border-[var(--border)] pt-4">
        <label className="mb-1 block text-sm text-muted">Type DELETE to confirm purge</label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          className="mb-4 w-full max-w-xs rounded-lg border px-3 py-2 font-mono text-sm"
        />

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        {success && <p className="mb-3 text-sm text-green-400">{success}</p>}

        <button
          type="button"
          disabled={purgeLoading || confirmText !== "DELETE" || previewCount === null}
          onClick={handlePurge}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {purgeLoading ? "Purging..." : "Purge old data"}
        </button>
      </div>
    </section>
  );
}
