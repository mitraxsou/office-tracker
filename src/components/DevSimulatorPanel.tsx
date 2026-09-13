"use client";

import { useCallback, useEffect, useState } from "react";
import type { AgentSyncOpenVisit } from "@/lib/agent-sync";

type DemoUserRow = {
  email: string;
  name: string;
  role: string;
  serial: string;
  userId?: string;
};

type SimulatorMeta = {
  users: DemoUserRow[];
  ssids: string[];
  remoteApiMode: boolean;
  remoteApiUrl: string | null;
  apiUrl: string | null;
  hasDemoUsersFile: boolean;
};

type Scenario =
  | "office_arrival"
  | "office_departure"
  | "activity_tick"
  | "session_resume"
  | "wifi_home"
  | "wifi_office"
  | "health_ping";

const SCENARIOS: Array<{ id: Scenario; label: string }> = [
  { id: "office_arrival", label: "Office arrival (visit start)" },
  { id: "office_departure", label: "Office departure (visit end)" },
  { id: "activity_tick", label: "Activity tick" },
  { id: "session_resume", label: "Session resume" },
  { id: "wifi_home", label: "Wi-Fi: switch to home" },
  { id: "wifi_office", label: "Wi-Fi: switch to office" },
  { id: "health_ping", label: "Health ping" },
];

export function DevSimulatorPanel() {
  const [meta, setMeta] = useState<SimulatorMeta | null>(null);
  const [email, setEmail] = useState("");
  const [ssid, setSsid] = useState("OfficeConnect");
  const [openVisit, setOpenVisit] = useState<AgentSyncOpenVisit | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string>("");

  const loadMeta = useCallback(async () => {
    const response = await fetch("/api/dev/simulator/users");
    if (!response.ok) {
      setLastResult("Simulator API unavailable. Check DEV_SIMULATOR_ENABLED and restart dev server.");
      return;
    }
    const data = (await response.json()) as SimulatorMeta;
    setMeta(data);
    if (!email && data.users[0]) {
      setEmail(data.users[0].email);
    }
    if (data.ssids[0]) {
      setSsid(data.ssids[0]);
    }
  }, [email]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  async function runScenario(scenario: Scenario) {
    if (!email) return;
    setBusy(true);
    setLastResult("");
    try {
      const response = await fetch("/api/dev/simulate-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          scenario,
          ssid,
          openVisit,
        }),
      });
      const data = await response.json();
      if (data.openVisit) {
        setOpenVisit(data.openVisit);
      } else if (scenario === "office_departure") {
        setOpenVisit(null);
      }
      setLastResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setLastResult(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {!meta?.hasDemoUsersFile ? (
        <div className="card border border-[var(--pwc-orange)] p-4 text-sm">
          <p className="font-medium">Demo users file missing</p>
          <p className="mt-2 text-muted">
            Run <code className="text-foreground">npm run seed:demo</code> when Postgres is reachable,
            or copy <code className="text-foreground">.demo-users.local.json</code> from a teammate.
          </p>
        </div>
      ) : null}

      {meta?.remoteApiMode ? (
        <div className="card p-4 text-sm">
          <p className="font-medium">Remote API mode</p>
          <p className="mt-1 text-muted">
            Events post to {meta.remoteApiUrl}. Open that portal for dashboards.
          </p>
        </div>
      ) : null}

      <div className="card grid gap-4 p-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Test user</span>
          <select
            className="w-full rounded border px-3 py-2"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          >
            {(meta?.users ?? []).map((user) => (
              <option key={user.email} value={user.email}>
                {user.name} ({user.email})
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Office SSID</span>
          <select
            className="w-full rounded border px-3 py-2"
            value={ssid}
            onChange={(event) => setSsid(event.target.value)}
          >
            {(meta?.ssids ?? ["OfficeConnect"]).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card p-4">
        <p className="mb-3 text-sm text-muted">Open visit state (for visit end)</p>
        <pre className="overflow-x-auto rounded bg-[var(--background)] p-3 text-xs">
          {openVisit ? JSON.stringify(openVisit, null, 2) : "No open visit"}
        </pre>
        <button
          type="button"
          className="btn-secondary mt-3 px-3 py-1 text-sm"
          onClick={() => setOpenVisit(null)}
        >
          Clear open visit
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            disabled={busy || !email}
            className="btn-primary px-4 py-3 text-left disabled:opacity-50"
            onClick={() => void runScenario(scenario.id)}
          >
            {scenario.label}
          </button>
        ))}
      </div>

      {lastResult ? (
        <div className="card p-4">
          <p className="mb-2 text-sm font-medium">Last response</p>
          <pre className="overflow-x-auto text-xs">{lastResult}</pre>
        </div>
      ) : null}
    </div>
  );
}
