"use client";

import { useEffect, useState } from "react";
import type { OfficeScheduleSuggestionResult } from "@/lib/office-schedule-sync";

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

export function insufficientHistoryMessage(officeDaysFound: number): string {
  const visits = officeDaysFound === 1 ? "office day" : "office days";
  return `Not enough office visit history yet to suggest a schedule. Found ${officeDaysFound} ${visits} in the last 8 weeks. We need a few weeks of visits.`;
}

function formatWorkDays(days: number[]): string {
  return days.map((day) => WEEKDAY_LABELS[day]).filter(Boolean).join(", ");
}

function formatWeekdayCounts(analysis: OfficeScheduleSuggestionResult): string {
  const counts = analysis.weekdayCounts
    .filter((item) => item.officeDays > 0)
    .map((item) => `${WEEKDAY_LABELS[item.weekday]} ${item.officeDays}`);
  return counts.length > 0 ? counts.join(", ") : "none";
}

export function OfficeScheduleSuggestionCard({
  adminUserId,
}: {
  adminUserId?: string;
} = {}) {
  const suggestionUrl = adminUserId
    ? `/api/admin/users/${adminUserId}/schedule-suggestion`
    : "/api/settings/schedule-suggestion";
  const prefsUrl = adminUserId
    ? `/api/admin/users/${adminUserId}/notification-prefs`
    : "/api/settings/notification-prefs";
  const [analysis, setAnalysis] = useState<OfficeScheduleSuggestionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(suggestionUrl, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Could not analyze office visits");
        return body as { analysis: OfficeScheduleSuggestionResult };
      })
      .then((body) => {
        if (active) setAnalysis(body.analysis);
      })
      .catch((fetchError: unknown) => {
        if (active) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Could not analyze office visits",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [suggestionUrl]);

  async function useSuggestion() {
    if (!analysis?.suggestion) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const response = await fetch(prefsUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workDays: analysis.suggestion.workDays,
        officeStartTime: analysis.suggestion.officeStartTime,
        ...(analysis.suggestion.officeEndTime
          ? { officeEndTime: analysis.suggestion.officeEndTime }
          : {}),
      }),
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(body.error ?? "Could not save the suggested schedule");
      return;
    }
    window.dispatchEvent(
      new CustomEvent("office-schedule-updated", {
        detail: analysis.suggestion,
      }),
    );
    setAnalysis({ ...analysis, status: "matches_current", suggestion: null });
    setMessage("Saved suggested usual days and times.");
  }

  return (
    <section className="card p-6">
      <h2 className="text-lg font-medium">Office schedule recommendation</h2>
      <p className="mt-1 text-sm text-muted">
        Review usual office days and times calculated from the last 8 weeks of visits.
      </p>

      {loading && <p className="mt-3 text-sm text-muted">Analyzing office visit history...</p>}

      {!loading && error && (
        <p className="mt-3 text-sm text-red-400">
          Could not load an office schedule recommendation: {error}
        </p>
      )}

      {!loading && !error && analysis?.status === "insufficient_history" && (
        <div className="mt-3 rounded-lg border border-[var(--border)] p-4">
          <p className="text-sm">{insufficientHistoryMessage(analysis.officeDaysFound)}</p>
          <p className="mt-2 text-xs text-muted">
            Office days found by weekday: {formatWeekdayCounts(analysis)}. A weekday qualifies
            after 3 office days, or when it appears in at least 40% of its occurrences in the
            window.
          </p>
        </div>
      )}

      {!loading && !error && analysis?.status === "matches_current" && (
        <div className="mt-3 rounded-lg border border-green-500/30 bg-green-500/5 p-4">
          <p className="text-sm">Your saved schedule matches the visit-history recommendation.</p>
          <p className="mt-2 text-xs text-muted">
            Based on {analysis.qualifyingOfficeDays} qualifying office days. Office days found by
            weekday: {formatWeekdayCounts(analysis)}.
          </p>
        </div>
      )}

      {!loading &&
        !error &&
        analysis?.status === "suggestion" &&
        analysis.suggestion &&
        !dismissed && (
          <div className="mt-3 rounded-lg border border-[var(--border)] p-4">
            <p className="text-sm font-medium">Suggested usual days and times</p>
            <p className="mt-1 text-sm text-muted">
              Days: {formatWorkDays(analysis.suggestion.workDays)}. Start:{" "}
              {analysis.suggestion.officeStartTime}
              {analysis.suggestion.officeEndTime
                ? `. End: ${analysis.suggestion.officeEndTime}.`
                : ". End: not enough check-outs to suggest."}
            </p>
            <p className="mt-2 text-xs text-muted">
              Based on {analysis.qualifyingOfficeDays} qualifying office days. Office days found by
              weekday: {formatWeekdayCounts(analysis)}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void useSuggestion()}
                disabled={saving}
                className="btn-primary px-3 py-2 text-sm disabled:opacity-50"
              >
                {saving ? "Saving..." : "Use suggested times"}
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                disabled={saving}
                className="btn-secondary px-3 py-2 text-sm disabled:opacity-50"
              >
                Keep current
              </button>
            </div>
          </div>
        )}

      {!loading && !error && analysis?.status === "suggestion" && dismissed && (
        <p className="mt-3 text-sm text-muted">Keeping the current usual days and times.</p>
      )}

      {message && <p className="mt-3 text-sm text-green-400">{message}</p>}
    </section>
  );
}
