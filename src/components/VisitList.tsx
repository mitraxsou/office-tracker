"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatTime, formatVisitDurationLabel, visitHasInvalidTimestamps } from "@/lib/visits";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import {
  canUserSelfCorrectVisitEnd,
  inferredCheckoutNotice,
} from "@/lib/visit-end";

type Visit = {
  id: string;
  startAt: Date | string;
  endAt: Date | string | null;
  source: string;
  ssid: string | null;
  endSource?: string | null;
};

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toDatetimeLocalValue(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function datetimeLocalToIso(value: string): string {
  // datetime-local is wall clock in the browser timezone (pilot laptops are usually IST).
  return new Date(value).toISOString();
}

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEndLocal, setEditEndLocal] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  if (visits.length === 0) {
    return <p className="text-sm text-muted">No visits recorded.</p>;
  }

  async function handleDelete(visit: Visit) {
    const start = asDate(visit.startAt);
    const end = visit.endAt ? asDate(visit.endAt) : null;
    const endLabel = end ? formatTime(end, timezone) : "now";
    if (
      !confirm(
        `Delete this manual check-in (${formatTime(start, timezone)} to ${endLabel})?`,
      )
    ) {
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    setActionLoading(true);
    const res = await fetch(`/api/visits?id=${encodeURIComponent(visit.id)}`, {
      method: "DELETE",
    });
    setActionLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error ?? "Failed to delete visit");
      return;
    }
    setActionSuccess("Manual check-in deleted.");
    router.refresh();
  }

  async function handleReport(visitId: string) {
    const message = reportMessage.trim();
    if (message.length < 5) {
      setActionError("Describe the issue in at least 5 characters.");
      return;
    }
    setActionError(null);
    setActionSuccess(null);
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
    setActionSuccess(
      "Correction request sent. Track status under Reports → Corrections.",
    );
    router.refresh();
  }

  async function handleSelfCorrect(visitId: string) {
    if (!editEndLocal) {
      setActionError("Choose a checkout time.");
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    setActionLoading(true);
    const res = await fetch(`/api/visits/${encodeURIComponent(visitId)}/checkout`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endAt: datetimeLocalToIso(editEndLocal) }),
    });
    setActionLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error ?? "Failed to update checkout");
      return;
    }
    setEditingId(null);
    setEditEndLocal("");
    setActionSuccess("Checkout time updated.");
    router.refresh();
  }

  return (
    <div>
      {actionError && (
        <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{actionError}</p>
      )}
      {actionSuccess && (
        <p className="mb-3 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">{actionSuccess}</p>
      )}
      <ul className="divide-y divide-[var(--border)]">
        {visits.map((visit) => {
          const start = asDate(visit.startAt);
          const end = visit.endAt ? asDate(visit.endAt) : null;
          const invalid = visitHasInvalidTimestamps({
            startAt: start,
            endAt: end,
          });
          const hoursLabel = formatVisitDurationLabel({
            startAt: start,
            endAt: end,
          });
          const isManual = visit.source === "manual";
          const isReporting = reportingId === visit.id;
          const isEditing = editingId === visit.id;
          const notice = inferredCheckoutNotice(visit.endSource);
          const canSelfCorrect =
            showActions && end && canUserSelfCorrectVisitEnd(visit.endSource);

          return (
            <li key={visit.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {formatTime(start, timezone)} –{" "}
                    {end ? formatTime(end, timezone) : "now"}
                  </p>
                  <p className="text-sm text-muted">
                    {isManual ? "Manual" : "Wi-Fi"}
                    {visit.ssid ? ` · ${visit.ssid}` : ""}
                    {visit.endSource === "inferred" ? " · estimated checkout" : ""}
                    {invalid ? " · end before start" : ""}
                  </p>
                  {notice && (
                    <p className="mt-1 max-w-md text-xs text-[var(--pwc-orange)]">{notice}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span
                    className={`text-sm font-medium ${invalid ? "text-red-400" : "text-accent"}`}
                  >
                    {hoursLabel}
                  </span>
                  {showActions && (
                    <div className="flex flex-wrap justify-end gap-2">
                      {isManual && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => void handleDelete(visit)}
                          className="text-xs text-red-400 hover:underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                      {canSelfCorrect && (
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => {
                            setActionError(null);
                            setReportingId(null);
                            if (isEditing) {
                              setEditingId(null);
                              setEditEndLocal("");
                            } else {
                              setEditingId(visit.id);
                              setEditEndLocal(toDatetimeLocalValue(end!, timezone));
                            }
                          }}
                          className="text-xs text-[var(--pwc-orange)] hover:underline disabled:opacity-50"
                        >
                          {isEditing ? "Cancel" : "Update checkout"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => {
                          setActionError(null);
                          setEditingId(null);
                          setReportingId(isReporting ? null : visit.id);
                          setReportMessage("");
                        }}
                        className="text-xs text-muted hover:text-accent hover:underline disabled:opacity-50"
                      >
                        {isReporting ? "Cancel" : "Ask admin"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {showActions && isEditing && end && (
                <div className="mt-3 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
                  <label className="block text-xs text-muted">
                    Last office time (same day as check-in). No admin approval needed.
                  </label>
                  <input
                    type="datetime-local"
                    value={editEndLocal}
                    onChange={(e) => setEditEndLocal(e.target.value)}
                    className="w-full max-w-xs rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => void handleSelfCorrect(visit.id)}
                    className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    {actionLoading ? "Saving..." : "Save checkout"}
                  </button>
                </div>
              )}
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
