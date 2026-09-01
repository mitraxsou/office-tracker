"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  type CorrectionSummary,
  type VisitSnapshot,
  formatCorrectionChange,
  formatSnapshotTime,
} from "@/lib/visit-corrections";

type ThreadMessage = {
  id: string;
  authorRole: string;
  body: string;
  createdAt: string;
  authorEmail: string;
  authorName: string | null;
};

type Report = {
  id: string;
  status: string;
  message: string;
  issueType: string | null;
  adminNote: string | null;
  visitSnapshot: VisitSnapshot | null;
  correctionSummary: CorrectionSummary | null;
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
  messages: ThreadMessage[];
};

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "open"
      ? "bg-amber-500/20 text-amber-300"
      : status === "resolved"
        ? "bg-green-500/20 text-green-400"
        : "bg-[var(--border)] text-muted";
  return (
    <span className={`rounded px-2 py-0.5 text-xs capitalize ${styles}`}>{status}</span>
  );
}

function MessageThread({ messages }: { messages: ThreadMessage[] }) {
  if (messages.length === 0) return null;
  return (
    <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
      <p className="text-xs font-medium text-muted">Conversation</p>
      {messages.map((m) => (
        <div
          key={m.id}
          className={`rounded-lg px-3 py-2 text-sm ${
            m.authorRole === "admin"
              ? "border border-[var(--pwc-orange)]/20 bg-[var(--pwc-orange)]/5"
              : "bg-[var(--background)]"
          }`}
        >
          <p className="text-xs text-muted">
            {m.authorRole === "admin" ? "Admin" : "User"} ({m.authorEmail}) ·{" "}
            {new Date(m.createdAt).toLocaleString("en-IN")}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
        </div>
      ))}
    </div>
  );
}

function CorrectionDiff({ summary }: { summary: CorrectionSummary }) {
  const lines = formatCorrectionChange(summary);
  if (lines.length === 0) return null;
  return (
    <div className="mt-2 rounded-lg border border-[var(--pwc-orange)]/30 bg-[var(--pwc-orange)]/5 p-3">
      <p className="mb-1 text-xs font-medium text-accent">What changed</p>
      <ul className="space-y-1 text-sm">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export function AdminVisitReports() {
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "all">("open");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [replyText, setReplyText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

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

  async function sendReply(id: string) {
    const body = replyText.trim();
    if (body.length < 2) return;
    setActionLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/visit-reports/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setActionLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to send reply");
      return;
    }
    setReplyingId(null);
    setReplyText("");
    load();
  }

  async function resolveReport(id: string, report: Report) {
    const note = adminNote.trim();
    if (note.length < 5) {
      setError("Resolution note is required (at least 5 characters explaining what changed)");
      return;
    }
    setActionLoading(true);
    setError(null);

    const correctionSummary =
      report.visitSnapshot && report.visit
        ? {
            before: report.visitSnapshot,
            after: {
              startAt: report.visit.startAt,
              endAt: report.visit.endAt,
              source: report.visit.source,
              ssid: report.visit.ssid,
            },
          }
        : undefined;

    const res = await fetch(`/api/admin/visit-reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "resolved",
        adminNote: note,
        correctionSummary,
      }),
    });
    setActionLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to resolve report");
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
          <h2 className="text-lg font-medium">Visit correction requests</h2>
          <p className="text-sm text-muted">
            Users report incorrect agent or manual visits here. Fix data on their user report, reply
            in the thread, then mark resolved with a note explaining what changed.
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
                  Reported {new Date(r.createdAt).toLocaleString("en-IN")}
                  {r.status === "resolved" && r.resolvedAt
                    ? ` · Resolved ${new Date(r.resolvedAt).toLocaleString("en-IN")} by ${r.resolvedByEmail ?? "admin"}`
                    : ""}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </div>

            {r.visit && (
              <p className="mt-2 text-sm text-muted">
                Visit (current): {formatSnapshotTime(r.visit.startAt)}
                {r.visit.endAt ? ` – ${formatSnapshotTime(r.visit.endAt)}` : " – open"} ·{" "}
                {r.visit.source}
                {r.visit.ssid ? ` · ${r.visit.ssid}` : ""}
              </p>
            )}

            {r.visitSnapshot && r.status === "open" && (
              <p className="mt-1 text-sm text-muted">
                Visit (at report): {formatSnapshotTime(r.visitSnapshot.startAt)}
                {r.visitSnapshot.endAt
                  ? ` – ${formatSnapshotTime(r.visitSnapshot.endAt)}`
                  : " – open"}
              </p>
            )}

            <p className="mt-2 whitespace-pre-wrap text-sm">{r.message}</p>

            {r.correctionSummary && <CorrectionDiff summary={r.correctionSummary} />}

            <MessageThread messages={r.messages} />

            {r.status === "open" && (
              <div className="mt-3 space-y-3">
                {replyingId === r.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={2}
                      placeholder="Reply to user (visible on their History page)"
                      className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => sendReply(r.id)}
                        className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                      >
                        {actionLoading ? "Sending..." : "Send reply"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingId(null);
                          setReplyText("");
                        }}
                        className="btn-secondary px-3 py-1.5 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : resolvingId === r.id ? (
                  <div className="space-y-2">
                    <label className="block text-xs text-muted">
                      Resolution note (required): explain what you changed, old to new values
                    </label>
                    <textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      rows={3}
                      placeholder="e.g. Updated check-out from 5pm to 6pm after fixing visit on user report"
                      className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => resolveReport(r.id, r)}
                        className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                      >
                        {actionLoading ? "Saving..." : "Mark resolved"}
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
                        setReplyingId(r.id);
                        setResolvingId(null);
                        setReplyText("");
                      }}
                      className="btn-secondary px-3 py-1.5 text-xs"
                    >
                      Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResolvingId(r.id);
                        setReplyingId(null);
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
