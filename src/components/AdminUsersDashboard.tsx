"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminUserManagement } from "./AdminUserManagement";
import { AdminNotificationPrefsForm } from "./AdminNotificationPrefsForm";
import { AdminResetPasswordButton } from "./AdminResetPasswordButton";
import { copyToClipboard } from "@/lib/clipboard";

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
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  hoursTarget: number;
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

export function AdminUsersDashboard() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyTokenId, setBusyTokenId] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [sharedCommand, setSharedCommand] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const [usersRes, auditRes] = await Promise.all([
      fetch("/api/admin/users"),
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
    setError(null);

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
            "admin_ooo_update",
          ].includes(l.action),
        ),
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    setSharedCommand(null);
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
      setSharedCommand(body.installCommand);
    }
    load(true);
  }

  async function shareToken(tokenId: string, reissue = false) {
    setBusyTokenId(tokenId);
    setActionError(null);
    setSharedCommand(null);
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
      setSharedCommand(body.installCommand);
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

  return (
    <div className="space-y-6">
      <AdminUserManagement onUserCreated={() => load(true)} />

      <div className="flex items-center justify-end gap-3">
        {refreshing && <span className="text-xs text-muted">Refreshing...</span>}
        <button
          type="button"
          onClick={() => load(true)}
          className="btn-secondary px-3 py-1 text-xs"
        >
          Refresh
        </button>
      </div>

      {sharedCommand && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm">
          Install command copied to clipboard.
          <pre className="mt-2 overflow-x-auto text-xs whitespace-pre-wrap">{sharedCommand}</pre>
        </div>
      )}

      {loading && users.length === 0 && <p className="text-muted">Loading users...</p>}
      {error && users.length === 0 && <p className="text-red-400">{error}</p>}
      {actionError && <p className="text-sm text-red-400">{actionError}</p>}

      {users.map((u) => (
        <section key={u.id} className="card p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">{u.email}</h2>
              {u.name && <p className="text-sm text-muted">{u.name}</p>}
              <Link
                href={`/admin/reports/users/${u.id}`}
                className="text-xs text-accent hover:underline"
              >
                View report →
              </Link>
              <p className="mt-1 text-xs text-muted">
                Today: {u.today.totalHours.toFixed(1)}h / {u.hoursTarget}h · Agent:{" "}
                {u.today.agentHealthy ? "Healthy" : "Stale"}
                {u.today.lastHeartbeat &&
                  ` · Last heartbeat ${new Date(u.today.lastHeartbeat).toLocaleString("en-IN")}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
                      <td className="py-2 pr-3">{t.label ?? "—"}</td>
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
                        {t.boundSerialNumber ?? "—"}
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
                            <span className="text-muted">Expired — issue a new token</span>
                          )}
                          {t.status === "bound" && (
                            <span className="text-muted">Bound — issue new token for another laptop</span>
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
                  {d.lastSeenAt && (
                    <span className="text-xs text-muted">
                      last seen {new Date(d.lastSeenAt).toLocaleString("en-IN")}
                    </span>
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
    </div>
  );
}
