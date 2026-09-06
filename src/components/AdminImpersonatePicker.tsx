"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SEARCH_DEBOUNCE_MS = 300;

type PickerUser = {
  id: string;
  email: string;
  name: string | null;
};

function UserSwitchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function AdminImpersonatePicker({
  placement = "header",
}: {
  placement?: "header" | "drawer";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<PickerUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inDrawer = placement === "drawer";

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadUsers = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ limit: "20", pageSize: "20" });
    if (searchQuery) qs.set("search", searchQuery);
    const res = await fetch(`/api/admin/users?${qs}`);
    setLoading(false);
    if (!res.ok) {
      setError("Could not load users");
      return;
    }
    const data = await res.json();
    setUsers(
      (data.users as PickerUser[]).map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
      })),
    );
  }, [open, searchQuery]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function startImpersonation(userId: string) {
    setBusyUserId(userId);
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}/impersonate`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusyUserId(null);
    if (!res.ok) {
      setError(body.error ?? "Failed to start view-as mode");
      return;
    }
    setOpen(false);
    router.push(body.redirectTo ?? "/dashboard");
    router.refresh();
  }

  const panelClassName = inDrawer
    ? "mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 shadow-lg"
    : "fixed left-4 right-4 top-20 z-50 mx-auto max-w-sm rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] p-3 shadow-xl md:absolute md:inset-auto md:right-0 md:top-full md:mt-2 md:w-80 md:max-w-none";

  return (
    <div className={inDrawer ? "min-w-0 flex-1" : "relative"}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`btn-secondary inline-flex items-center justify-center p-2 ${
          inDrawer ? "min-h-11 w-full gap-2" : ""
        }`}
        aria-label="View as user"
        title="View as user"
        aria-expanded={open}
      >
        <UserSwitchIcon />
        {inDrawer && <span className="text-xs">View as user</span>}
      </button>

      {open && (
        <>
          {!inDrawer && (
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-label="Close user picker"
              onClick={() => setOpen(false)}
            />
          )}
          <div className={panelClassName}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">View as user</p>
              {inDrawer && (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs text-muted hover:text-accent"
                >
                  Close
                </button>
              )}
            </div>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search email or name"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              autoFocus
            />
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
            <ul className={`mt-2 space-y-1 overflow-y-auto ${inDrawer ? "max-h-40" : "max-h-64"}`}>
              {loading && users.length === 0 ? (
                <li className="py-3 text-sm text-muted">Loading...</li>
              ) : users.length === 0 ? (
                <li className="py-3 text-sm text-muted">No users found.</li>
              ) : (
                users.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      disabled={busyUserId === user.id}
                      onClick={() => startImpersonation(user.id)}
                      className="block w-full rounded-lg p-2 text-left text-sm hover:bg-[var(--border)] disabled:opacity-50"
                    >
                      <span className="block truncate font-medium">{user.email}</span>
                      {user.name && (
                        <span className="block truncate text-xs text-muted">{user.name}</span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
