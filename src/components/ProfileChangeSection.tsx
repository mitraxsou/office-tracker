"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProfileChangeRequestSummary } from "@/lib/profile-change-requests";

type ProfileChangeState = {
  openRequest: ProfileChangeRequestSummary | null;
  requests: ProfileChangeRequestSummary[];
};

type ProfileChangeSectionProps = {
  currentName: string | null;
  currentEmail: string;
  profileChangeState: ProfileChangeState;
  blocked?: boolean;
  blockedMessage?: string | null;
};

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "open"
      ? "bg-amber-500/20 text-amber-300"
      : status === "approved"
        ? "bg-green-500/20 text-green-400"
        : "bg-[var(--border)] text-muted";
  return (
    <span className={`rounded px-2 py-0.5 text-xs capitalize ${styles}`}>{status}</span>
  );
}

function formatProfileDelta(request: ProfileChangeRequestSummary) {
  const parts: string[] = [];
  if (request.requestedName !== null && request.requestedName !== request.currentName) {
    parts.push(`Name: ${request.currentName ?? "(none)"} → ${request.requestedName}`);
  }
  if (request.requestedEmail && request.requestedEmail !== request.currentEmail) {
    parts.push(`Email: ${request.currentEmail} → ${request.requestedEmail}`);
  }
  return parts.join(" · ");
}

export function ProfileChangeSection({
  currentName,
  currentEmail,
  profileChangeState: initialState,
  blocked,
  blockedMessage,
}: ProfileChangeSectionProps) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [requestedName, setRequestedName] = useState(currentName ?? "");
  const [requestedEmail, setRequestedEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const openRequest = state.openRequest;
  const pastRequests = state.requests.filter((r) => r.id !== openRequest?.id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (openRequest || blocked) return;

    setLoading(true);
    setError(null);
    setSubmitted(false);

    const body: { requestedName?: string; requestedEmail?: string; message?: string } = {};
    const nameTrimmed = requestedName.trim();
    const emailTrimmed = requestedEmail.trim();
    if (nameTrimmed && nameTrimmed !== (currentName ?? "")) {
      body.requestedName = nameTrimmed;
    }
    if (emailTrimmed && emailTrimmed !== currentEmail) {
      body.requestedEmail = emailTrimmed;
    }
    if (message.trim()) {
      body.message = message.trim();
    }

    const res = await fetch("/api/settings/profile-change-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to submit profile change request");
      return;
    }

    const data = await res.json();
    setState({
      openRequest: data.request,
      requests: [data.request, ...state.requests],
    });
    setSubmitted(true);
    router.refresh();
  }

  async function cancelRequest() {
    if (!openRequest) return;

    setCancelling(true);
    setError(null);
    setSubmitted(false);

    const res = await fetch(`/api/settings/profile-change-request?id=${openRequest.id}`, {
      method: "DELETE",
    });

    setCancelling(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to cancel request");
      return;
    }

    setState({
      openRequest: null,
      requests: state.requests.filter((r) => r.id !== openRequest.id),
    });
    setRequestedName(currentName ?? "");
    setRequestedEmail("");
    router.refresh();
  }

  return (
    <section className="card p-6">
      <h2 className="mb-2 text-lg font-medium">Display name and email</h2>
      <p className="mb-3 text-sm text-muted">
        Request a change to your display name or PwC email. An admin must approve before your
        account is updated.
      </p>

      {blocked && blockedMessage ? (
        <p className="rounded-lg bg-[var(--border)]/50 px-3 py-2 text-sm text-muted">
          {blockedMessage}
        </p>
      ) : openRequest ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="open" />
            <span className="text-xs text-muted">Pending admin approval</span>
          </div>
          <p className="mt-3 font-medium">{formatProfileDelta(openRequest)}</p>
          {openRequest.message && (
            <p className="mt-2 text-muted">Your note: {openRequest.message}</p>
          )}
          <button
            type="button"
            disabled={cancelling}
            onClick={cancelRequest}
            className="mt-3 text-xs text-muted hover:underline disabled:opacity-50"
          >
            {cancelling ? "Cancelling..." : "Cancel request"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted">Current display name</dt>
              <dd className="font-medium">{currentName ?? "(not set)"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Current email</dt>
              <dd className="font-medium">{currentEmail}</dd>
            </div>
          </dl>

          <label className="block text-sm">
            <span className="text-muted">Request new display name (optional)</span>
            <input
              type="text"
              value={requestedName}
              onChange={(e) => setRequestedName(e.target.value)}
              className="mt-1 block w-full max-w-md rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Request new PwC email (optional)</span>
            <input
              type="email"
              value={requestedEmail}
              onChange={(e) => setRequestedEmail(e.target.value)}
              placeholder="you@pwc.com"
              className="mt-1 block w-full max-w-md rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Note for admin (optional)</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              className="mt-1 block w-full max-w-md rounded-lg border px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={
              loading ||
              (requestedName.trim() === (currentName ?? "") && !requestedEmail.trim())
            }
            className="btn-primary px-4 py-2 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Request profile change"}
          </button>
        </form>
      )}

      {pastRequests.length > 0 && (
        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <h3 className="mb-3 text-sm font-medium">Previous requests</h3>
          <ul className="space-y-3">
            {pastRequests.map((r) => (
              <li key={r.id} className="rounded-lg border border-[var(--border)] p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted">
                      Submitted {new Date(r.createdAt).toLocaleString("en-IN")}
                      {r.reviewedAt
                        ? ` · ${r.status} ${new Date(r.reviewedAt).toLocaleString("en-IN")}`
                        : ""}
                    </p>
                    <p className="mt-1">{formatProfileDelta(r)}</p>
                    {r.adminNote && (
                      <p className="mt-1 text-xs text-muted">Admin note: {r.adminNote}</p>
                    )}
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
      {submitted && (
        <p className="mt-3 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
          Profile change request sent to admin for review.
        </p>
      )}
    </section>
  );
}
