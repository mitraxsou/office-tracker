"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatHours, formatTime } from "@/lib/visits";
import { DEFAULT_TIMEZONE } from "@/lib/constants";

type Visit = {
  id: string;
  startAt: Date;
  endAt: Date | null;
  source: string;
  ssid: string | null;
};

export function VisitList({
  visits,
  timezone = DEFAULT_TIMEZONE,
  showActions = true,
}: {
  visits: Visit[];
  timezone?: string;
  showActions?: boolean;
}) {
  const router = useRouter();
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportMessage, setReportMessage] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  if (visits.length === 0) {
    return <p className="text-sm text-muted">No visits recorded.</p>;
  }

  async function handleDelete(visitId: string) {
    if (!confirm("Delete this manual visit? This cannot be undone.")) return;
    setActionError(null);
    setActionLoading(true);
    const res = await fetch(`/api/visits?id=${visitId}`, { method: "DELETE" });
    setActionLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error ?? "Failed to delete visit");
      return;
    }
    router.refresh();
  }

  async function handleReport(visitId: string) {
    const message = reportMessage.trim();
    if (message.length < 5) {
      setActionError("Describe the issue in at least 5 characters.");
      return;
    }
    setActionError(null);
    setActionLoading(true);
    const res = await fetch("/api/visits/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitId, message }),
    });
    setActionLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error ?? "Failed to submit report");
      return;
    }
    setReportingId(null);
    setReportMessage("");
    router.refresh();
  }

  return (
    <div>
      {actionError && (
        <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{actionError}</p>
      )}
      <ul className="divide-y divide-[var(--border)]">
        {visits.map((visit) => {
          const end = visit.endAt ?? new Date();
          const durationMs = Math.max(0, end.getTime() - visit.startAt.getTime());
          const hours = durationMs / (1000 * 60 * 60);
          const isManual = visit.source === "manual";
          const isReporting = reportingId === visit.id;

          return (
            <li key={visit.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {formatTime(visit.startAt, timezone)} –{" "}
                    {visit.endAt ? formatTime(visit.endAt, timezone) : "now"}
                  </p>
                  <p className="text-sm text-muted">
                    {isManual ? "Manual" : "Wi-Fi"}
                    {visit.ssid ? ` · ${visit.ssid}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-sm font-medium text-accent">{formatHours(hours)}</span>
                  {showActions && (
                    <div className="flex flex-wrap justify-end gap-2">
                      {isManual && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleDelete(visit.id)}
                          className="text-xs text-red-400 hover:underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => {
                          setActionError(null);
                          setReportingId(isReporting ? null : visit.id);
                          setReportMessage("");
                        }}
                        className="text-xs text-muted hover:text-accent hover:underline disabled:opacity-50"
                      >
                        {isReporting ? "Cancel" : "Report issue"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {showActions && isReporting && (
                <div className="mt-3 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                  <label className="block text-xs text-muted">
                    What is wrong with this visit? An admin will review and correct it.
                  </label>
                  <textarea
                    value={reportMessage}
                    onChange={(e) => setReportMessage(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="e.g. Wrong check-out time, visit should have ended at 6pm"
                    className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleReport(visit.id)}
                    className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    {actionLoading ? "Sending..." : "Send to admin"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
