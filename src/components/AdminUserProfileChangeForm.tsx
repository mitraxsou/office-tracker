"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  userId: string;
  currentName: string | null;
  currentEmail: string;
  blocked?: boolean;
  blockedMessage?: string | null;
};

export function AdminUserProfileChangeForm({
  userId,
  currentName,
  currentEmail,
  blocked,
  blockedMessage,
}: Props) {
  const router = useRouter();
  const [requestedName, setRequestedName] = useState("");
  const [requestedEmail, setRequestedEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (blocked) return;

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
        Submit a name or PwC email change for this user. Another admin (or you) must approve it
        under User requests.
      </p>

      {blocked && blockedMessage ? (
        <p className="text-sm text-muted">{blockedMessage}</p>
      ) : (
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
      )}

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {success && (
        <p className="mt-2 text-sm text-green-400">
          Profile change request submitted for admin review.
        </p>
      )}
    </div>
  );
}
