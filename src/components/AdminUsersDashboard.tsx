"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminUserManagement } from "./AdminUserManagement";
import { AdminNotificationPrefsForm } from "./AdminNotificationPrefsForm";
import { AdminResetPasswordButton } from "./AdminResetPasswordButton";
import { AdminUserEditModal } from "./AdminUserEditModal";
import { copyToClipboard } from "@/lib/clipboard";
import { DEFAULT_ADMIN_USERS_PAGE_SIZE } from "@/lib/admin-users";
import { AdminAgentVersionReport } from "./AdminAgentVersionReport";

type TokenRow = {
  id: string;
  prefix: string;
  label: string | null;
  boundSerialNumber: string | null;
  status: "pending" | "bound" | "expired";
  shareable: boolean;
  expiresAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

type DeviceRow = {
  id: string;
  serialNumber: string;
  lastSeenAt: string | null;
  agentScriptVersion: string | null;
  agentVersionStale: boolean;
  forceAgentUpdate: boolean;
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  registrationSource: string;
  createdAt: string;
  hoursTarget: number;
  serverAgentVersion: string;
  tokens: TokenRow[];
  devices: DeviceRow[];
  today: {
    totalHours: number;
    metTarget: boolean;
    agentHealthy: boolean;
    lastHeartbeat: string | null;
  };
};

type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  actorEmail: string;
  targetEmail: string | null;
};

const SEARCH_DEBOUNCE_MS = 300;

function registrationSourceLabel(source: string): string {
  switch (source) {
    case "otp_self":
      return "Self-registered (OTP)";
    case "seed":
      return "Seed";
    default:
      return "Admin-created";
  }
}

export function AdminUsersDashboard() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_ADMIN_USERS_PAGE_SIZE);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [otpSelfOnly, setOtpSelfOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyTokenId, setBusyTokenId] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [busyDeviceId, setBusyDeviceId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [sharedCommands, setSharedCommands] = useState<{
    installCommand: string;
    updateCommand: string;
  } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (searchQuery) qs.set("search", searchQuery);
      if (otpSelfOnly) qs.set("source", "otp_self");

      const [usersRes, auditRes] = await Promise.all([
        fetch(`/api/admin/users?${qs}`),
        fetch("/api/admin/reports"),
      ]);

      if (!silent) setLoading(false);
      else setRefreshing(false);

      if (!usersRes.ok) {
        if (!silent) setError("Failed to load users");
        return;
      }

      const usersData = await usersRes.json();
      setUsers(usersData.users);
      setTotal(usersData.total ?? usersData.users.length);
      setError(null);
      setSelectedIds((prev) => {
        const next = new Set<string>();
        for (const id of prev) {
          if (usersData.users.some((u: UserRow) => u.id === id)) next.add(id);
        }
        return next;
      });

      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLog(
          (auditData.auditLog as AuditEntry[]).filter((l) =>
            [
              "user_create",
              "agent_token_issue",
              "agent_token_share",
              "agent_token_reissue",
              "agent_token_revoke",
              "agent_device_registered",
              "device_remove",
              "device_remove_self",
              "password_reset",
              "admin_notification_prefs_update",
              "admin_custom_notification",
              "admin_ooo_update",
              "admin_profile_edit",
              "agent_update_push",
            ].includes(l.action),
          ),
        );
      }
    },
    [page, pageSize, searchQuery, otpSelfOnly],
  );

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const allOnPageSelected = users.length > 0 && users.every((u) => selectedIds.has(u.id));

  const selectedOnPageCount = useMemo(
    () => users.filter((u) => selectedIds.has(u.id)).length,
    [users, selectedIds],
  );

  function toggleSelect(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const u of users) next.delete(u.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const u of users) next.add(u.id);
        return next;
      });
    }
  }

  async function changeRole(userId: string, role: "admin" | "user") {
    setBusyUserId(userId);
    setActionError(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setBusyUserId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setActionError(body.error ?? "Failed to update role");
      return;
    }
    load(true);
  }

  async function issueToken(userId: string) {
    setBusyUserId(userId);
    setActionError(null);
    setSharedCommands(null);
    const res = await fetch(`/api/admin/users/${userId}/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setBusyUserId(null);
    if (!res.ok) {
      setActionError("Failed to issue token");
      return;
    }
    const body = await res.json();
    if (body.installCommand) {
      await copyToClipboard(body.installCommand);
      setSharedCommands({
        installCommand: body.installCommand,
        updateCommand: body.updateCommand ?? "",
      });
    }
    load(true);
  }

  async function shareToken(tokenId: string, reissue = false) {
    setBusyTokenId(tokenId);
    setActionError(null);
    setSharedCommands(null);
    const res = await fetch(`/api/admin/tokens/${tokenId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reissue ? { action: "reissue" } : {}),
    });
    setBusyTokenId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setActionError(body.error ?? "Failed to get install command");
      return;
    }
    const body = await res.json();
    if (body.installCommand) {
      await copyToClipboard(body.installCommand);
      setSharedCommands({
        installCommand: body.installCommand,
        updateCommand: body.updateCommand ?? "",
      });
    }
    if (body.reissued) load(true);
  }

  async function revokeToken(tokenId: string) {
    if (!confirm("Revoke this install token? It will no longer work for new installs.")) return;
    setBusyTokenId(tokenId);
    setActionError(null);
    const res = await fetch(`/api/admin/tokens/${tokenId}`, { method: "DELETE" });
    setBusyTokenId(null);
    if (!res.ok) {
      setActionError("Failed to revoke token");
      return;
    }
    load(true);
  }

  async function removeDevice(deviceId: string) {
    if (!confirm("Remove this laptop from the user's account?")) return;
    const res = await fetch(`/api/admin/devices/${deviceId}`, { method: "DELETE" });
    if (!res.ok) {
      setActionError("Failed to remove device");
      return;
    }
    load(true);
  }

  async function pushDeviceAgentUpdate(deviceId: string) {
    setBusyDeviceId(deviceId);
    setActionError(null);
    const res = await fetch(`/api/admin/devices/${deviceId}/agent-update`, {
      method: "POST",
    });
    setBusyDeviceId(null);
    if (!res.ok) {
      setActionError("Failed to push agent update");
      return;
    }
    setUsers((current) =>
      current.map((user) => ({
        ...user,
        devices: user.devices.map((device) =>
          device.id === deviceId ? { ...device, forceAgentUpdate: true } : device,
        ),
      })),
    );
  }

  async function bulkPushAgentUpdate() {
    const userIds = Array.from(selectedIds);
    if (userIds.length === 0) return;
    if (
      !confirm(
        `Push agent update to ${userIds.length} selected user${userIds.length === 1 ? "" : "s"}?`,
      )
    ) {
      return;
    }

    setBulkBusy(true);
    setActionError(null);
    setActionMessage(null);
    const res = await fetch("/api/admin/agent-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds }),
    });
    setBulkBusy(false);
    if (!res.ok) {
      setActionError("Failed to push agent update");
      return;
    }
    const body = await res.json();
    setActionMessage(
      `Agent update queued for ${body.deviceCount ?? 0} laptop${body.deviceCount === 1 ? "" : "s"} across ${userIds.length} user${userIds.length === 1 ? "" : "s"}.`,
    );
    setSelectedIds(new Set());
    load(true);
  }

  return (
    <div className="space-y-6">
      <AdminUserManagement onUserCreated={() => load(true)} />
      <AdminAgentVersionReport />

      <section className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[200px] flex-1 text-sm">
            <span className="text-muted">Search users</span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Email or name"
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setOtpSelfOnly((v) => !v);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1 text-xs ${
                otpSelfOnly
                  ? "bg-[var(--pwc-orange)] text-white"
                  : "border border-[var(--border)] text-muted"
              }`}
            >
              Self-registered only
            </button>
            {refreshing && <span className="text-xs text-muted">Refreshing...</span>}
            <button
              type="button"
              onClick={() => load(true)}
              className="btn-secondary px-3 py-2 text-sm"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted">
            {total === 0
              ? "No users found"
              : `Showing ${rangeStart}-${rangeEnd} of ${total}`}
            {searchQuery ? ` matching "${searchQuery}"` : ""}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="btn-secondary px-3 py-1 text-xs disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-muted">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="btn-secondary px-3 py-1 text-xs disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--pwc-orange)]/30 bg-[var(--pwc-orange-muted)]/10 px-3 py-2">
            <span className="text-sm">
              {selectedIds.size} selected
              {selectedOnPageCount < selectedIds.size &&
                ` (${selectedOnPageCount} on this page)`}
            </span>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={bulkPushAgentUpdate}
              className="btn-secondary px-3 py-1 text-xs disabled:opacity-50"
            >
              {bulkBusy ? "Pushing..." : "Push agent update"}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-muted hover:text-[var(--foreground)]"
            >
              Clear selection
            </button>
          </div>
        )}
      </section>

      {sharedCommands && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm">
          <p>
            Install command copied. Send the user one command only, run from the folder that
            contains the .ps1 files.
          </p>
          <div className="mt-3 rounded border border-[var(--border)] bg-[var(--background-elevated)] p-3">
            <p className="text-sm font-medium">Install (first time)</p>
            <p className="mt-1 text-xs text-muted">
              For a laptop that has never run the agent.
            </p>
            <pre className="mt-2 overflow-x-auto text-xs whitespace-pre-wrap">
              {sharedCommands.installCommand}
            </pre>
            <button
              type="button"
              className="btn-secondary mt-2 px-3 py-1 text-xs"
              onClick={() => copyToClipboard(sharedCommands.installCommand)}
            >
              Copy install command
            </button>
          </div>
          {sharedCommands.updateCommand ? (
            <div className="mt-3 rounded border border-[var(--border)] bg-[var(--background-elevated)] p-3">
              <p className="text-sm font-medium">Update (already installed)</p>
              <p className="mt-1 text-xs text-muted">
                Only to refresh an agent that is already on the laptop.
              </p>
              <pre className="mt-2 overflow-x-auto text-xs whitespace-pre-wrap">
                {sharedCommands.updateCommand}
              </pre>
              <button
                type="button"
                className="btn-secondary mt-2 px-3 py-1 text-xs"
                onClick={() => copyToClipboard(sharedCommands.updateCommand)}
              >
                Copy update command
              </button>
            </div>
          ) : null}
        </div>
      )}

      {loading && users.length === 0 && <p className="text-muted">Loading users...</p>}
      {error && users.length === 0 && <p className="text-red-400">{error}</p>}
      {actionError && <p className="text-sm text-red-400">{actionError}</p>}
      {actionMessage && <p className="text-sm text-green-400">{actionMessage}</p>}

      {users.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allOnPageSelected}
            onChange={toggleSelectAllOnPage}
            id="select-all-users"
            className="rounded"
          />
          <label htmlFor="select-all-users" className="text-muted">
            Select all on this page
          </label>
        </div>
      )}

      {users.map((u) => (
        <section key={u.id} className="card p-6">
          <div className="mb-4 flex flex-wrap items-start gap-3">
            <input
              type="checkbox"
              checked={selectedIds.has(u.id)}
              onChange={() => toggleSelect(u.id)}
              aria-label={`Select ${u.email}`}
              className="mt-1 rounded"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-medium">{u.email}</h2>
              {u.name && <p className="text-sm text-muted">{u.name}</p>}
              <p className="mt-1 text-xs text-muted">
                Source: {registrationSourceLabel(u.registrationSource)} · Joined{" "}
                {new Date(u.createdAt).toLocaleDateString("en-IN")}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <Link
                  href={`/admin/reports/users/${u.id}`}
                  className="text-accent hover:underline"
                >
                  Manage data
                </Link>
                <Link
                  href="/admin/visit-reports"
                  className="text-accent hover:underline"
                >
                  User requests
                </Link>
                <button
                  type="button"
                  onClick={() => setEditingUser(u)}
                  className="text-accent hover:underline"
                >
                  Request profile change
                </button>
              </div>
              <p className="mt-1 text-xs text-muted">
                Today: {u.today.totalHours.toFixed(1)}h / {u.hoursTarget}h · Agent:{" "}
                {u.today.agentHealthy ? "Healthy" : "Stale"}
                {u.today.lastHeartbeat &&
                  ` · Last activity ${new Date(u.today.lastHeartbeat).toLocaleString("en-IN")}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  u.registrationSource === "otp_self"
                    ? "bg-blue-500/20 text-blue-300"
                    : "bg-[var(--border)] text-muted"
                }`}
              >
                {registrationSourceLabel(u.registrationSource)}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  u.role === "admin"
                    ? "bg-[var(--pwc-orange)]/20 text-accent"
                    : "bg-[var(--border)] text-muted"
                }`}
              >
                {u.role === "admin" ? "Admin" : "User"}
              </span>
              {u.role === "admin" ? (
                <button
                  type="button"
                  disabled={busyUserId === u.id}
                  onClick={() => changeRole(u.id, "user")}
                  className="text-xs text-accent hover:underline disabled:opacity-50"
                >
                  Remove admin
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busyUserId === u.id}
                  onClick={() => changeRole(u.id, "admin")}
                  className="text-xs text-accent hover:underline disabled:opacity-50"
                >
                  Make admin
                </button>
              )}
              <button
                type="button"
                disabled={busyUserId === u.id}
                onClick={() => issueToken(u.id)}
                className="btn-secondary px-3 py-1 text-xs disabled:opacity-50"
              >
                {busyUserId === u.id ? "..." : "Issue laptop token"}
              </button>
              <AdminResetPasswordButton
                userId={u.id}
                userEmail={u.email}
                disabled={busyUserId === u.id}
                onDone={() => load(true)}
              />
            </div>
          </div>

          <h3 className="mb-2 text-sm font-medium">Install tokens</h3>
          {u.tokens.length === 0 ? (
            <p className="mb-4 text-sm text-muted">No active tokens. Issue one to set up a laptop.</p>
          ) : (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs text-muted">
                    <th className="py-2 pr-3">Label</th>
                    <th className="py-2 pr-3">Prefix</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Laptop serial</th>
                    <th className="py-2 pr-3">Issued</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {u.tokens.map((t) => (
                    <tr key={t.id} className="border-b border-[var(--border)]">
                      <td className="py-2 pr-3">{t.label ?? "-"}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{t.prefix}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={
                            t.status === "bound"
                              ? "text-green-400"
                              : t.status === "expired"
                                ? "text-red-400"
                                : "text-amber-300"
                          }
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">
                        {t.boundSerialNumber ?? "-"}
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted">
                        {new Date(t.createdAt).toLocaleString("en-IN")}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-2 text-xs">
                          {t.status === "pending" && (
                            <>
                              <button
                                type="button"
                                disabled={busyTokenId === t.id}
                                onClick={() => shareToken(t.id)}
                                className="text-accent hover:underline disabled:opacity-50"
                              >
                                {busyTokenId === t.id ? "..." : "Copy install cmd"}
                              </button>
                              {!t.shareable && (
                                <button
                                  type="button"
                                  disabled={busyTokenId === t.id}
                                  onClick={() => shareToken(t.id, true)}
                                  className="text-accent hover:underline disabled:opacity-50"
                                >
                                  Reissue
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={busyTokenId === t.id}
                                onClick={() => revokeToken(t.id)}
                                className="text-red-400 hover:underline disabled:opacity-50"
                              >
                                Revoke
                              </button>
                            </>
                          )}
                          {t.status === "expired" && (
                            <span className="text-muted">Expired - issue a new token</span>
                          )}
                          {t.status === "bound" && (
                            <span className="text-muted">
                              Bound - issue new token for another laptop
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="mb-2 text-sm font-medium">Registered laptops</h3>
          {u.devices.length === 0 ? (
            <p className="text-sm text-muted">No laptops registered yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)] text-sm">
              {u.devices.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 py-2">
                  <code className="text-accent">{d.serialNumber}</code>
                  <span className={d.agentVersionStale ? "text-xs text-accent" : "text-xs text-green-400"}>
                    {d.agentScriptVersion ?? "version not reported"}
                    {d.agentVersionStale ? " (needs update)" : " (current)"}
                  </span>
                  {d.lastSeenAt && (
                    <span className="text-xs text-muted">
                      last seen {new Date(d.lastSeenAt).toLocaleString("en-IN")}
                    </span>
                  )}
                  {d.agentVersionStale && (
                    <button
                      type="button"
                      onClick={() => pushDeviceAgentUpdate(d.id)}
                      disabled={busyDeviceId === d.id || d.forceAgentUpdate}
                      className="text-xs text-blue-400 hover:underline disabled:opacity-50"
                    >
                      {busyDeviceId === d.id
                        ? "Pushing..."
                        : d.forceAgentUpdate
                          ? "Update pending"
                          : "Push update"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeDevice(d.id)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <AdminNotificationPrefsForm userId={u.id} userEmail={u.email} />
        </section>
      ))}

      {total > pageSize && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="btn-secondary px-3 py-1 text-xs disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-muted">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="btn-secondary px-3 py-1 text-xs disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-medium">User & agent activity</h2>
        {auditLog.length === 0 ? (
          <p className="text-sm text-muted">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {auditLog.slice(0, 30).map((log) => (
              <li key={log.id} className="py-2">
                <span className="text-muted">
                  {new Date(log.createdAt).toLocaleString("en-IN")}
                </span>
                {" · "}
                <span className="font-medium">{log.action.replace(/_/g, " ")}</span>
                {" by "}
                {log.actorEmail}
                {log.targetEmail && <> for {log.targetEmail}</>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {editingUser && (
        <AdminUserEditModal
          userId={editingUser.id}
          email={editingUser.email}
          name={editingUser.name}
          onClose={() => setEditingUser(null)}
          onSaved={() => load(true)}
        />
      )}
    </div>
  );
}
