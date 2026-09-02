"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProfileChangeRequestSummary } from "@/lib/profile-change-requests";

type Props = {
  userId: string;
  currentName: string | null;
  currentEmail: string;
  openRequest?: ProfileChangeRequestSummary | null;
  blocked?: boolean;
  blockedMessage?: string | null;
};

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

export function AdminUserProfileChangeForm({
  userId,
  currentName,
  currentEmail,
  openRequest: initialOpenRequest = null,
  blocked,
  blockedMessage,
}: Props) {
  const router = useRouter();
  const [openRequest, setOpenRequest] = useState(initialOpenRequest);
  const [requestedName, setRequestedName] = useState("");
  const [requestedEmail, setRequestedEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (blocked || openRequest) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    const body: { requestedName?: string; requestedEmail?: string; message?: string } = {};
    const nameTrimmed = requestedName.trim();
    const emailTrimmed = requestedEmail.trim();
    if (nameTrimmed) body.requestedName = nameTrimmed;
    if (emailTrimmed) body.requestedEmail = emailTrimmed;
    if (message.trim()) body.message = message.trim();

    const res = await fetch(`/api/admin/users/${userId}/profile-change-request`, {
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
    setOpenRequest(data.request);
    setRequestedName("");
    setRequestedEmail("");
    setMessage("");
    setSuccess(true);
    router.refresh();
  }

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-4">
      <h4 className="mb-2 text-sm font-medium">Request profile change</h4>
      <p className="mb-3 text-sm text-muted">
        Submit a name or PwC email change for this user. An admin must approve it under User
        requests before it applies.
      </p>

      {openRequest && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium text-amber-300">Pending profile change request</p>
          <p className="mt-1 text-muted">{formatProfileDelta(openRequest)}</p>
          {openRequest.message && <p className="mt-2">{openRequest.message}</p>}
          <p className="mt-2 text-xs text-muted">
            Submitted {new Date(openRequest.createdAt).toLocaleString("en-IN")}. Review under User
            requests.
          </p>
        </div>
      )}

      {blocked && blockedMessage ? (
        <p className="text-sm text-muted">{blockedMessage}</p>
      ) : !openRequest ? (
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted">New display name (optional)</span>
            <input
              type="text"
              value={requestedName}
              onChange={(e) => setRequestedName(e.target.value)}
              placeholder={currentName ?? "(not set)"}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">New PwC email (optional)</span>
            <input
              type="email"
              value={requestedEmail}
              onChange={(e) => setRequestedEmail(e.target.value)}
              placeholder={currentEmail}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-muted">Note (optional)</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={loading || (!requestedName.trim() && !requestedEmail.trim())}
              className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit profile change request"}
            </button>
          </div>
        </form>
      ) : null}

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {success && !openRequest && (
        <p className="mt-2 text-sm text-green-400">
          Profile change request submitted for admin review.
        </p>
      )}
    </div>
  );
}
