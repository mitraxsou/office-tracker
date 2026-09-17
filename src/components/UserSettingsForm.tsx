"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { timezoneOptionsForUser } from "@/lib/constants";

import type { EnrichedDevice } from "@/lib/device-enrichment";
import { agentStatusClass } from "@/lib/device-status";
import type { TimezoneRequestSummary } from "@/lib/timezone-requests";

type Device = EnrichedDevice;

type TimezoneRequestState = {
  openRequest: TimezoneRequestSummary | null;
  latestRequest: TimezoneRequestSummary | null;
};

type UserSettingsSections = {
  org?: boolean;
  timezone?: boolean;
  devices?: boolean;
};

type UserSettingsFormProps = {
  timezone: string;
  hoursTarget: number;
  monthlyDaysTarget: number;
  isWelcome?: boolean;
  devices: Device[];
  onDevicesChange: (devices: Device[]) => void;
  timezoneRequestState: TimezoneRequestState;
  sections?: UserSettingsSections;
};

function timezoneLabel(value: string) {
  const opt = timezoneOptionsForUser(value).find((o) => o.value === value);
  return opt?.label ?? value;
}

export function UserSettingsForm({
  timezone,
  hoursTarget,
  monthlyDaysTarget,
  isWelcome,
  devices,
  onDevicesChange,
  timezoneRequestState: initialTimezoneRequestState,
  sections: sectionFlags,
}: UserSettingsFormProps) {
  const showOrg = sectionFlags?.org ?? true;
  const showTimezone = sectionFlags?.timezone ?? true;
  const showDevices = sectionFlags?.devices ?? true;

  const router = useRouter();
  const [tz, setTz] = useState(timezone);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [timezoneRequestState, setTimezoneRequestState] = useState(initialTimezoneRequestState);

  const openRequest = timezoneRequestState.openRequest;
  const rejectedRequest =
    timezoneRequestState.latestRequest?.status === "rejected"
      ? timezoneRequestState.latestRequest
      : null;

  async function handleTimezoneRequest(e: React.FormEvent) {
    e.preventDefault();
    if (openRequest) return;

    setLoading(true);
    setError(null);
    setSubmitted(false);
    setSuccessMessage(null);

    const res = await fetch("/api/settings/timezone-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestedTimezone: tz }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to submit timezone request");
      return;
    }

    const data = await res.json();
    setTimezoneRequestState({
      openRequest: data.request,
      latestRequest: null,
    });
    setSubmitted(true);
    router.refresh();
  }

  async function cancelTimezoneRequest() {
    if (!openRequest) return;

    setCancelling(true);
    setError(null);
    setSubmitted(false);

    const res = await fetch(`/api/settings/timezone-request?id=${openRequest.id}`, {
      method: "DELETE",
    });

    setCancelling(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to cancel request");
      return;
    }

    setTimezoneRequestState({ openRequest: null, latestRequest: null });
    setTz(timezone);
    router.refresh();
  }

  async function requestDeviceRemoval(deviceId: string, serialNumber: string) {
    const reason = prompt(
      `Request removal of laptop ${serialNumber}? An admin must approve before it is removed.\n\nOptional reason:`,
    );
    if (reason === null) return;

    setRemovingId(deviceId);
    setError(null);
    setSuccessMessage(null);
    const res = await fetch(`/api/settings/devices/${deviceId}/removal-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: reason.trim() || undefined }),
    });
    setRemovingId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to submit removal request");
      return;
    }
    setSuccessMessage("Removal request sent to admin for review.");
    onDevicesChange(
      devices.map((d) => (d.id === deviceId ? { ...d, pendingRemoval: true } : d)),
    );
    router.refresh();
  }

  const welcomeBanner =
    isWelcome && showDevices ? (
      <div className="rounded-lg bg-[var(--pwc-orange-muted)] px-4 py-3 text-sm">
        Account created. Your install token is in the{" "}
        <a href="#install" className="text-accent hover:underline">
          Install or reinstall
        </a>{" "}
        section above. Copy the install command and run it in PowerShell on your laptop.
      </div>
    ) : null;

  const orgBlock = showOrg ? (
    <section className="card p-6">
      <h2 className="mb-2 text-lg font-medium">Org settings (read-only)</h2>
      <p className="text-sm text-muted">Set by admin. Applies to all users.</p>
      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <dt className="text-muted">Daily hours target</dt>
          <dd className="font-medium">{hoursTarget}h</dd>
        </div>
        <div>
          <dt className="text-muted">Monthly office days target</dt>
          <dd className="font-medium">{monthlyDaysTarget} days</dd>
        </div>
      </dl>
    </section>
  ) : null;

  const timezoneBlock = showTimezone ? (
    <section className="card p-6">
      <h2 className="mb-2 text-lg font-medium">Your timezone</h2>
      <p className="mb-3 text-sm text-muted">
        Used for today&apos;s hours, visit times, and notification schedule (office days and alert
        times). Changes require admin approval.
      </p>

      {openRequest ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300">
              Pending admin approval
            </span>
          </div>
          <dl className="mt-3 space-y-2">
            <div>
              <dt className="text-xs text-muted">Current timezone</dt>
              <dd className="font-medium">{timezoneLabel(openRequest.currentTimezone)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Requested timezone</dt>
              <dd className="font-medium">{timezoneLabel(openRequest.requestedTimezone)}</dd>
            </div>
          </dl>
          <button
            type="button"
            disabled={cancelling}
            onClick={cancelTimezoneRequest}
            className="mt-3 text-xs text-muted hover:underline disabled:opacity-50"
          >
            {cancelling ? "Cancelling..." : "Cancel request"}
          </button>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm">
            Active timezone: <span className="font-medium">{timezoneLabel(timezone)}</span>
          </p>
          {rejectedRequest?.adminNote && (
            <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              Your last timezone request was rejected: {rejectedRequest.adminNote}
            </p>
          )}
          <label className="block text-sm">
            <span className="text-muted">Request new timezone</span>
            <select
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              className="mt-1 block w-full max-w-md rounded-lg border px-3 py-2"
            >
              {timezoneOptionsForUser(timezone).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={loading || tz === timezone}
            className="btn-primary mt-4 px-4 py-2 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Request timezone change"}
          </button>
        </>
      )}
    </section>
  ) : null;

  const devicesBlock = showDevices ? (
    <section className="card p-6">
      <h2 className="mb-2 text-lg font-medium">Registered laptops</h2>
      <p className="mb-4 text-sm text-muted">
        Registered on first agent sync. To remove a laptop, submit a request. An admin must approve
        it (prevents accidental removal).
      </p>
      {devices.length === 0 ? (
        <p className="text-sm text-muted">No laptops registered yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {devices.map((d) => (
            <li key={d.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <code className="text-accent">{d.serialNumber}</code>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    d.pendingRemoval
                      ? "bg-amber-500/20 text-amber-300"
                      : `${agentStatusClass(d.agentStatus)} bg-[var(--background)]`
                  }`}
                >
                  {d.pendingRemoval ? "Removal pending" : d.agentStatusLabel}
                </span>
                {d.boundTokenLabel && (
                  <span className="text-xs text-muted">Token: {d.boundTokenLabel}</span>
                )}
                {!d.isUninstalled && (
                  <span className="text-xs text-muted">
                    Agent{" "}
                    {d.agentScriptVersion ? `v${d.agentScriptVersion}` : "version unknown"}
                    {d.agentVersionStale ? (
                      <span className="text-[var(--pwc-orange)]">
                        {" "}
                        · update to v{d.serverAgentVersion} recommended
                      </span>
                    ) : (
                      <span className="text-green-400/90"> · up to date</span>
                    )}
                    {d.forceAgentUpdate && (
                      <span className="text-amber-300"> · update queued by admin</span>
                    )}
                  </span>
                )}
              </div>
              {d.lastSeenAt && (
                <p className="mt-1 text-xs text-muted">
                  Last seen {new Date(d.lastSeenAt).toLocaleString("en-IN")}
                </p>
              )}
              {!d.pendingRemoval && (
                <button
                  type="button"
                  disabled={removingId === d.id}
                  onClick={() => requestDeviceRemoval(d.id, d.serialNumber)}
                  className="mt-2 text-xs text-red-400 hover:underline disabled:opacity-50"
                >
                  {removingId === d.id ? "Submitting..." : "Request removal"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  ) : null;

  const feedback = (
    <>
      {successMessage && (
        <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">{successMessage}</p>
      )}
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
      {submitted && (
        <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
          Timezone change request sent to admin for review.
        </p>
      )}
    </>
  );

  if (showTimezone) {
    return (
      <form onSubmit={handleTimezoneRequest} className="space-y-6">
        {welcomeBanner}
        {orgBlock}
        {timezoneBlock}
        {devicesBlock}
        {feedback}
      </form>
    );
  }

  return (
    <div className="space-y-6">
      {welcomeBanner}
      {orgBlock}
      {devicesBlock}
      {feedback}
    </div>
  );
}
