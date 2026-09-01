"use client";

import { useCallback, useEffect, useState } from "react";
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

function CorrectionDiff({
  summary,
  timezone = "Asia/Kolkata",
}: {
  summary: CorrectionSummary;
  timezone?: string;
}) {
  const lines = formatCorrectionChange(summary, timezone);
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

function MessageThread({ messages }: { messages: ThreadMessage[] }) {
  if (messages.length === 0) return null;
  return (
    <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
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
            {m.authorRole === "admin" ? "Admin" : "You"} ·{" "}
            {new Date(m.createdAt).toLocaleString("en-IN")}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
        </div>
      ))}
    </div>
  );
}

export function UserCorrectionRequests() {
  const [requests, setRequests] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/user/correction-requests");
    setLoading(false);
    if (!res.ok) {
      setError("Failed to load correction requests");
      return;
    }
    const data = await res.json();
    setRequests(data.requests ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function sendReply(requestId: string) {
    const body = replyText.trim();
    if (body.length < 2) return;
    setReplyLoading(true);
    setError(null);
    const res = await fetch(`/api/user/correction-requests/${requestId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setReplyLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to send reply");
      return;
    }
    setReplyText("");
    load();
  }

  const openCount = requests.filter((r) => r.status === "open").length;

  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">My correction requests</h2>
          <p className="text-sm text-muted">
            Track status and read admin replies on visits you reported from History.
          </p>
        </div>
        {openCount > 0 && (
          <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-300">
            {openCount} open
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-muted">Loading...</p>}
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {!loading && requests.length === 0 && (
        <p className="text-sm text-muted">
          No correction requests yet. Use &quot;Report issue&quot; on a visit in History.
        </p>
      )}

      <div className="space-y-4">
        {requests.map((r) => {
          const expanded = expandedId === r.id;
          return (
            <article
              key={r.id}
              className="rounded-lg border border-[var(--border)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted">
                    Submitted {new Date(r.createdAt).toLocaleString("en-IN")}
                    {r.resolvedAt
                      ? ` · Resolved ${new Date(r.resolvedAt).toLocaleString("en-IN")}`
                      : ""}
                  </p>
                  {r.visit && (
                    <p className="mt-1 text-sm text-muted">
                      Visit: {formatSnapshotTime(r.visit.startAt)}
                      {r.visit.endAt ? ` – ${formatSnapshotTime(r.visit.endAt)}` : " – open"} ·{" "}
                      {r.visit.source}
                    </p>
                  )}
                </div>
                <StatusBadge status={r.status} />
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm">{r.message}</p>

              {r.correctionSummary && <CorrectionDiff summary={r.correctionSummary} />}

              <MessageThread messages={r.messages} />

              <button
                type="button"
                onClick={() => {
                  setExpandedId(expanded ? null : r.id);
                  setReplyText("");
                }}
                className="mt-3 text-xs text-accent hover:underline"
              >
                {expanded ? "Hide thread" : r.status === "open" ? "Reply or view thread" : "View thread"}
              </button>

              {expanded && r.status === "open" && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={2}
                    placeholder="Add a follow-up message for admin"
                    className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={replyLoading || replyText.trim().length < 2}
                    onClick={() => sendReply(r.id)}
                    className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    {replyLoading ? "Sending..." : "Send reply"}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
