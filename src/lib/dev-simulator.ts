import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";
import { DEFAULT_OFFICE_SSIDS } from "./constants";
import type { AgentSyncEvent, AgentSyncOpenVisit } from "./agent-sync";

export type DemoSimulatorUser = {
  email: string;
  name: string;
  role: string;
  password: string;
  token: string;
  serial: string;
  userId?: string;
};

export type DemoUsersFile = {
  apiUrl: string;
  users: DemoSimulatorUser[];
};

export type SimulatorScenario =
  | "office_arrival"
  | "office_departure"
  | "activity_tick"
  | "session_resume"
  | "wifi_home"
  | "wifi_office"
  | "health_ping";

export type BuildSimulatorSyncParams = {
  scenario: SimulatorScenario;
  ssid?: string;
  previousSsid?: string;
  openVisit?: AgentSyncOpenVisit | null;
  minutesAgo?: number;
};

export const DEMO_USERS_FILE = ".demo-users.local.json";
export const DEMO_HOME_SSID = "HomeWiFi";

export function isDevSimulatorEnabled(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "development") return true;
  return process.env.DEV_SIMULATOR_ENABLED === "1";
}

export function isRemoteApiMode(): boolean {
  return process.env.OFFICETRACKER_REMOTE_API === "1";
}

export function getRemoteApiUrl(): string {
  const raw =
    process.env.OFFICETRACKER_REMOTE_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_REMOTE_API_URL?.trim() ||
    "https://office-tracker-dev.vercel.app";
  return raw.replace(/\/$/, "");
}

export function demoUsersFilePath(cwd = process.cwd()): string {
  return resolve(cwd, DEMO_USERS_FILE);
}

export function loadDemoUsersFile(cwd = process.cwd()): DemoUsersFile | null {
  const path = demoUsersFilePath(cwd);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as DemoUsersFile;
    if (!parsed?.users?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function resolveDemoUser(email: string, cwd = process.cwd()): DemoSimulatorUser | null {
  const file = loadDemoUsersFile(cwd);
  if (!file) return null;
  const normalized = email.trim().toLowerCase();
  return file.users.find((user) => user.email.toLowerCase() === normalized) ?? null;
}

export function listDemoUsers(cwd = process.cwd()): DemoSimulatorUser[] {
  return loadDemoUsersFile(cwd)?.users ?? [];
}

export function officeSsidOptions(): string[] {
  return [...DEFAULT_OFFICE_SSIDS, DEMO_HOME_SSID];
}

function isoOffset(minutesAgo = 0): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

function newEventId(): string {
  return randomUUID();
}

export function buildSimulatorSyncEvents(
  params: BuildSimulatorSyncParams,
): { events: AgentSyncEvent[]; openVisit: AgentSyncOpenVisit | null } {
  const officeSsid = params.ssid && isOfficeSsidChoice(params.ssid) ? params.ssid : DEFAULT_OFFICE_SSIDS[0];
  const homeSsid = params.previousSsid && !isOfficeSsidChoice(params.previousSsid)
    ? params.previousSsid
    : DEMO_HOME_SSID;
  const at = isoOffset(params.minutesAgo ?? 0);
  const events: AgentSyncEvent[] = [];
  let openVisit = params.openVisit ?? null;

  switch (params.scenario) {
    case "office_arrival": {
      const localVisitId = newEventId();
      events.push(
        {
          id: newEventId(),
          type: "ssid_changed",
          at,
          ssid: officeSsid,
          previousSsid: homeSsid,
        },
        {
          id: newEventId(),
          type: "visit_start",
          at,
          ssid: officeSsid,
          localVisitId,
        },
      );
      openVisit = { localVisitId, startAt: at, ssid: officeSsid };
      break;
    }
    case "office_departure": {
      const localVisitId = openVisit?.localVisitId ?? newEventId();
      events.push({
        id: newEventId(),
        type: "visit_end",
        at,
        localVisitId,
      });
      events.push({
        id: newEventId(),
        type: "ssid_changed",
        at,
        ssid: homeSsid,
        previousSsid: openVisit?.ssid ?? officeSsid,
      });
      openVisit = null;
      break;
    }
    case "activity_tick": {
      const tickSsid = params.ssid ?? openVisit?.ssid ?? homeSsid;
      events.push({
        id: newEventId(),
        type: "activity_tick",
        at,
        ssid: tickSsid,
      });
      break;
    }
    case "session_resume": {
      const resumeSsid = params.ssid ?? openVisit?.ssid ?? homeSsid;
      events.push(
        {
          id: newEventId(),
          type: "session_resume",
          at,
          ssid: resumeSsid,
        },
        {
          id: newEventId(),
          type: "activity_tick",
          at,
          ssid: resumeSsid,
        },
      );
      break;
    }
    case "wifi_home": {
      events.push({
        id: newEventId(),
        type: "ssid_changed",
        at,
        ssid: homeSsid,
        previousSsid: openVisit?.ssid ?? officeSsid,
      });
      break;
    }
    case "wifi_office": {
      events.push({
        id: newEventId(),
        type: "ssid_changed",
        at,
        ssid: officeSsid,
        previousSsid: homeSsid,
      });
      if (!openVisit) {
        const localVisitId = newEventId();
        events.push({
          id: newEventId(),
          type: "visit_start",
          at,
          ssid: officeSsid,
          localVisitId,
        });
        openVisit = { localVisitId, startAt: at, ssid: officeSsid };
      }
      break;
    }
    case "health_ping": {
      events.push({ id: newEventId(), type: "health_ping" });
      break;
    }
  }

  return { events, openVisit };
}

export function buildAgentSyncBody(params: {
  user: DemoSimulatorUser;
  events: AgentSyncEvent[];
  openVisit?: AgentSyncOpenVisit | null;
  syncTrigger?: string;
  apiUrl?: string;
}) {
  return {
    token: params.user.token,
    serialNumber: params.user.serial,
    apiUrl: params.apiUrl ?? getRemoteApiUrl(),
    scriptVersion: "1.3.2",
    syncTrigger: params.syncTrigger ?? "simulator",
    events: params.events,
    openVisit: params.openVisit ?? undefined,
  };
}

function isOfficeSsidChoice(ssid: string): boolean {
  const normalized = ssid.trim().toLowerCase();
  return DEFAULT_OFFICE_SSIDS.some((allowed) => normalized.startsWith(allowed.toLowerCase()));
}
