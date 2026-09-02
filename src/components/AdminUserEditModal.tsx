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
  const [editName, setEditName] = useState(name ?? "");
  const [editEmail, setEditEmail] = useState(email);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        email: editEmail,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to update profile");
      return;
    }

    onSaved();
    onClose();
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
          Edit profile
        </h3>
        <p className="mb-4 text-sm text-muted">
          Admins can correct name and email directly. Changes apply immediately.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm">
            <span className="text-muted">Display name</span>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">PwC email</span>
            <input
              type="email"
              required
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {loading ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
