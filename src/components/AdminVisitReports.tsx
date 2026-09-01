"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Report = {
  id: string;
  status: string;
  message: string;
  issueType: string | null;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  user: { id: string; email: string; name: string | null };
  visit: {
    id: string;
    startAt: string;
    endAt: string | null;
    source: string;
    ssid: string | null;
  } | null;
  resolvedByEmail: string | null;
};

export function AdminVisitReports() {
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "all">("open");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/visit-reports?status=${statusFilter}&limit=50`);
    setLoading(false);
    if (!res.ok) {
      setError("Failed to load reports");
      return;
    }
    const data = await res.json();
    setReports(data.reports ?? []);
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function resolveReport(id: string) {
    setError(null);
    const res = await fetch("/api/admin/visit-reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        status: "resolved",
        adminNote: adminNote.trim() || undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to resolve report");
      return;
    }
    setResolvingId(null);
    setAdminNote("");
    load();
  }

  function formatVisitTime(iso: string) {
    return new Date(iso).toLocaleString("en-IN");
  }

  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Visit correction requests</h2>
          <p className="text-sm text-muted">
            Users report incorrect agent or manual visits here. Fix data on their user report, then
            mark resolved.
          </p>
        </div>
        <div className="flex gap-2">
          {(["open", "resolved", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs ${
                statusFilter === s
                  ? "bg-[var(--pwc-orange)]/20 font-medium text-accent"
                  : "text-muted hover:bg-[var(--border)]"
              }`}
            >
              {s === "open" ? "Open" : s === "resolved" ? "Resolved" : "All"}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-muted">Loading...</p>}
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {!loading && reports.length === 0 && (
        <p className="text-sm text-muted">No {statusFilter === "all" ? "" : statusFilter} reports.</p>
      )}

      <div className="space-y-4">
        {reports.map((r) => (
          <article
            key={r.id}
            className="rounded-lg border border-[var(--border)] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  <Link
                    href={`/admin/reports/users/${r.user.id}`}
                    className="text-accent hover:underline"
                  >
                    {r.user.email}
                  </Link>
                  {r.user.name ? ` (${r.user.name})` : ""}
                </p>
                <p className="text-xs text-muted">
                  Reported {formatVisitTime(r.createdAt)}
                  {r.status === "resolved" && r.resolvedAt
                    ? ` · Resolved ${formatVisitTime(r.resolvedAt)} by ${r.resolvedByEmail ?? "admin"}`
                    : ""}
                </p>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  r.status === "open"
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-green-500/20 text-green-400"
                }`}
              >
                {r.status}
              </span>
            </div>

            {r.visit && (
              <p className="mt-2 text-sm text-muted">
                Visit: {formatVisitTime(r.visit.startAt)}
                {r.visit.endAt ? ` – ${formatVisitTime(r.visit.endAt)}` : " – open"} ·{" "}
                {r.visit.source}
                {r.visit.ssid ? ` · ${r.visit.ssid}` : ""}
              </p>
            )}

            <p className="mt-2 whitespace-pre-wrap text-sm">{r.message}</p>

            {r.adminNote && (
              <p className="mt-2 text-sm text-muted">
                Admin note: {r.adminNote}
              </p>
            )}

            {r.status === "open" && (
              <div className="mt-3">
                {resolvingId === r.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      rows={2}
                      placeholder="Optional note (e.g. times corrected)"
                      className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => resolveReport(r.id)}
                        className="btn-primary px-3 py-1.5 text-xs"
                      >
                        Mark resolved
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResolvingId(null);
                          setAdminNote("");
                        }}
                        className="btn-secondary px-3 py-1.5 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/reports/users/${r.user.id}`}
                      className="btn-secondary px-3 py-1.5 text-xs"
                    >
                      Open user report
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setResolvingId(r.id);
                        setAdminNote("");
                      }}
                      className="text-xs text-accent hover:underline"
                    >
                      Mark resolved
                    </button>
                  </div>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
