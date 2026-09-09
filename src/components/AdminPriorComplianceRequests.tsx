"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatMonthLabel } from "@/lib/month-range";

type PriorComplianceRequest = {
  id: string;
  monthKey: string;
  typicalCheckInTime: string;
  qualifyingDaysCount: number;
  message: string | null;
  status: string;
  adminNote: string | null;
  source: string;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; email: string; name: string | null; timezone: string };
  reviewedByEmail: string | null;
};

export function AdminPriorComplianceRequests() {
  const [statusFilter, setStatusFilter] = useState<"open" | "approved" | "rejected" | "all">("open");
  const [requests, setRequests] = useState<PriorComplianceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(
      `/api/admin/prior-compliance-requests?status=${statusFilter}&limit=50`,
    );
    setLoading(false);
    if (!res.ok) {
      setError("Failed to load prior compliance requests");
      return;
    }
    const data = await res.json();
    setRequests(data.requests ?? []);
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function resolveRequest(id: string, status: "approved" | "rejected") {
    setError(null);
    const res = await fetch(`/api/admin/prior-compliance-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        adminNote: adminNote.trim() || undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to update request");
      return;
    }
    setResolvingId(null);
    setAdminNote("");
    load();
  }

  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Prior compliance declarations</h2>
          <p className="text-sm text-muted">
            Users declare months they were office-compliant before joining. Approve to backfill
            qualifying office days with their stated check-in time.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["open", "approved", "rejected", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs capitalize ${
                statusFilter === s
                  ? "bg-[var(--pwc-orange)]/20 font-medium text-accent"
                  : "text-muted hover:bg-[var(--border)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-muted">Loading...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!loading && requests.length === 0 && (
        <p className="text-sm text-muted">No requests in this filter.</p>
      )}

      <ul className="space-y-4">
        {requests.map((r) => (
          <li key={r.id} className="rounded-lg border border-[var(--border)] p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link
                  href={`/admin/reports/users/${r.user.id}`}
                  className="font-medium text-accent hover:underline"
                >
                  {r.user.name ?? r.user.email}
                </Link>
                <p className="mt-1 text-muted">
                  {formatMonthLabel(r.monthKey, r.user.timezone)} · check-in {r.typicalCheckInTime}{" "}
                  · {r.qualifyingDaysCount} qualifying days · source {r.source}
                </p>
                {r.message && <p className="mt-2 whitespace-pre-wrap">{r.message}</p>}
              </div>
              <span className="rounded px-2 py-0.5 text-xs capitalize bg-[var(--border)] text-muted">
                {r.status}
              </span>
            </div>

            {r.status === "open" && (
              <div className="mt-3 border-t border-[var(--border)] pt-3">
                {resolvingId === r.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      rows={2}
                      placeholder="Optional note for the user"
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void resolveRequest(r.id, "approved")}
                        className="btn-primary px-3 py-1.5 text-sm"
                      >
                        Approve and backfill visits
                      </button>
                      <button
                        type="button"
                        onClick={() => void resolveRequest(r.id, "rejected")}
                        className="rounded-lg border px-3 py-1.5 text-sm text-muted hover:bg-[var(--border)]"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResolvingId(null);
                          setAdminNote("");
                        }}
                        className="text-sm text-muted hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setResolvingId(r.id)}
                    className="text-sm text-accent hover:underline"
                  >
                    Review
                  </button>
                )}
              </div>
            )}

            {r.adminNote && (
              <p className="mt-2 text-xs text-muted">Admin note: {r.adminNote}</p>
            )}
            {r.reviewedByEmail && (
              <p className="mt-1 text-xs text-muted">
                Reviewed by {r.reviewedByEmail}
                {r.reviewedAt ? ` · ${new Date(r.reviewedAt).toLocaleString("en-IN")}` : ""}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
