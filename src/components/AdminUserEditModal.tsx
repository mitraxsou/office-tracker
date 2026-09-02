"use client";

import { useEffect, useState } from "react";

type Props = {
  userId: string;
  email: string;
  name: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export function AdminUserEditModal({ userId, email, name, onClose, onSaved }: Props) {
  const [requestedName, setRequestedName] = useState("");
  const [requestedEmail, setRequestedEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to submit profile change request");
      return;
    }

    setSuccess(true);
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="edit-user-title"
      >
        <h3 id="edit-user-title" className="mb-1 text-lg font-medium">
          Request profile change
        </h3>
        <p className="mb-4 text-sm text-muted">
          Submit a name or PwC email change for {email}. An admin must approve it under User
          requests before it applies.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm">
            <span className="text-muted">New display name (optional)</span>
            <input
              type="text"
              value={requestedName}
              onChange={(e) => setRequestedName(e.target.value)}
              placeholder={name ?? "(not set)"}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">New PwC email (optional)</span>
            <input
              type="email"
              value={requestedEmail}
              onChange={(e) => setRequestedEmail(e.target.value)}
              placeholder={email}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Note (optional)</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && (
            <p className="text-sm text-green-400">
              Profile change request submitted for admin review.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">
              {success ? "Close" : "Cancel"}
            </button>
            {!success && (
              <button
                type="submit"
                disabled={loading || (!requestedName.trim() && !requestedEmail.trim())}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Submit request"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
