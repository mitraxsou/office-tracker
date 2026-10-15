import { LIVE_PRESENCE_TYPES } from "./activity-signal";
import { isOfficeSsid, normalizeSsid } from "./constants";
import { prisma } from "./db";
import { sanitizeSyncTrigger, syncTriggerLabel } from "./presence-timeline";

/**
 * Settings agent status keeps these stored events separate:
 * sync batch receipt, device lastSeenAt, Wi-Fi/presence sample, activity tick.
 * Do not fold them into one last-seen time.
 */
export const IN_OFFICE_NOW_RULE =
  "Same flag as the dashboard. It follows the newer of the activity tick and the Wi-Fi/presence sample. An open visit can stay on the dashboard after this flag turns No.";

export type AgentStatusSample = {
  at: Date;
  ssid: string | null;
  storedInOffice: boolean;
  source: string;
};

export type AgentStatusEvidence = {
  syncBatch: {
    createdAt: Date;
    deviceId: string | null;
    syncTrigger: string | null;
  } | null;
  presenceSample: AgentStatusSample | null;
  heartbeatSample: AgentStatusSample | null;
  activityTick: {
    at: Date;
    ssid: string | null;
    inOffice: boolean;
  } | null;
};

export type AgentStatusDeviceRef = {
  id: string;
  serialNumber: string;
  lastSeenAt: Date | null;
};

export type AgentStatusWifiSample = {
  at: string;
  ssid: string | null;
  /** Null when the sample has no SSID. False only when a name was stored and it is not on the office list. */
  officeSsid: boolean | null;
  storedInOffice: boolean;
  source: string;
  sourceLabel: string;
};

export type AgentStatusDiagnostics = {
  lastSuccessfulSync: {
    at: string;
    trigger: string | null;
    triggerLabel: string | null;
    deviceId: string | null;
    serialNumber: string | null;
  } | null;
  lastDeviceContactAt: string | null;
  lastWifiSample: AgentStatusWifiSample | null;
  lastActivityTick: {
    at: string;
    ssid: string | null;
    officeSsid: boolean | null;
    inOffice: boolean;
  } | null;
  minutesSinceLastActivityTick: number | null;
  openVisit: {
    startAt: string;
    ssid: string | null;
    officeSsid: boolean | null;
    source: string;
    sourceLabel: string;
  } | null;
  inOfficeNowRule: string;
  inOfficeNowSignal: {
    at: string;
    ssid: string | null;
    officeSsid: boolean | null;
    inOffice: boolean;
    source: string;
    sourceLabel: string;
  } | null;
};

export function visitSourceLabel(source: string): string {
  switch (source) {
    case "wifi":
      return "Wi-Fi visit";
    case "manual":
      return "Manual check-in";
    case "admin":
      return "Admin correction";
    default:
      return agentEvidenceSourceLabel(source);
  }
}

export function agentEvidenceSourceLabel(source: string): string {
  switch (source) {
    case "health_ping":
      return "Health snapshot";
    case "wifi_connected":
      return "Wi-Fi connected";
    case "wifi_disconnected":
      return "Wi-Fi disconnected";
    case "ssid_changed":
      return "Wi-Fi changed";
    case "session_resume":
      return "Laptop resumed";
    case "session_suspend":
      return "Laptop suspended";
    case "activity_tick":
      return "Activity tick";
    case "wifi":
      return "Heartbeat Wi-Fi sample";
    case "manual":
      return "Manual check-in";
    case "admin":
      return "Admin correction";
    default:
      return source.replaceAll("_", " ");
  }
}

export function cleanStoredSsid(ssid: string | null | undefined): string | null {
  if (!ssid) return null;
  const normalized = normalizeSsid(ssid).trim();
  return normalized.length > 0 ? normalized : null;
}

/** Null means no SSID was stored. Do not treat a missing name as a non-office network. */
export function officeSsidFlag(
  ssid: string | null | undefined,
  officeSsids: string[],
): boolean | null {
  const cleaned = cleanStoredSsid(ssid);
  if (!cleaned) return null;
  return isOfficeSsid(cleaned, officeSsids);
}

export function pickLatestWifiSample(
  presence: AgentStatusSample | null,
  heartbeat: AgentStatusSample | null,
): AgentStatusSample | null {
  if (!presence) return heartbeat;
  if (!heartbeat) return presence;
  if (heartbeat.at.getTime() > presence.at.getTime()) return heartbeat;
  return presence;
}

function readSyncTrigger(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return sanitizeSyncTrigger((payload as { syncTrigger?: unknown }).syncTrigger);
}

export async function fetchAgentStatusEvidence(userId: string): Promise<AgentStatusEvidence> {
  const [syncBatch, presence, heartbeat, activityTick] = await Promise.all([
    prisma.agentEvent.findFirst({
      where: { userId, type: "sync_batch", status: "accepted" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, deviceId: true, payload: true },
    }),
    prisma.presenceTransition.findFirst({
      where: { userId, type: { in: [...LIVE_PRESENCE_TYPES] } },
      orderBy: { at: "desc" },
      select: { at: true, ssid: true, inOffice: true, type: true },
    }),
    prisma.heartbeat.findFirst({
      where: { userId },
      orderBy: { recordedAt: "desc" },
      select: { recordedAt: true, ssid: true, inOffice: true, source: true },
    }),
    prisma.activityTick.findFirst({
      where: { userId },
      orderBy: { at: "desc" },
      select: { at: true, ssid: true, inOffice: true },
    }),
  ]);

  return {
    syncBatch: syncBatch
      ? {
          createdAt: syncBatch.createdAt,
          deviceId: syncBatch.deviceId,
          syncTrigger: readSyncTrigger(syncBatch.payload),
        }
      : null,
    presenceSample: presence
      ? {
          at: presence.at,
          ssid: presence.ssid,
          storedInOffice: presence.inOffice,
          source: presence.type,
        }
      : null,
    heartbeatSample: heartbeat
      ? {
          at: heartbeat.recordedAt,
          ssid: heartbeat.ssid,
          storedInOffice: heartbeat.inOffice,
          source: heartbeat.source,
        }
      : null,
    activityTick: activityTick
      ? {
          at: activityTick.at,
          ssid: activityTick.ssid,
          inOffice: activityTick.inOffice,
        }
      : null,
  };
}

function latestDeviceContact(devices: AgentStatusDeviceRef[]): Date | null {
  let latest: Date | null = null;
  for (const device of devices) {
    if (!device.lastSeenAt) continue;
    if (!latest || device.lastSeenAt.getTime() > latest.getTime()) {
      latest = device.lastSeenAt;
    }
  }
  return latest;
}

function toWifiSample(
  sample: AgentStatusSample,
  officeSsids: string[],
): AgentStatusWifiSample {
  const ssid = cleanStoredSsid(sample.ssid);
  return {
    at: sample.at.toISOString(),
    ssid,
    officeSsid: officeSsidFlag(ssid, officeSsids),
    storedInOffice: sample.storedInOffice,
    source: sample.source,
    sourceLabel: agentEvidenceSourceLabel(sample.source),
  };
}

export function buildAgentStatusDiagnostics(input: {
  evidence: AgentStatusEvidence;
  devices: AgentStatusDeviceRef[];
  officeSsids: string[];
  openVisit: { startAt: Date; ssid: string | null; source: string } | null;
  inOfficeNowSignal: {
    at: Date;
    inOffice: boolean;
    ssid: string | null;
    source: string;
  } | null;
  now?: Date;
}): AgentStatusDiagnostics {
  const officeSsids = input.officeSsids;
  const sync = input.evidence.syncBatch;
  const syncedDevice = sync?.deviceId
    ? input.devices.find((device) => device.id === sync.deviceId) ?? null
    : null;
  const wifi = pickLatestWifiSample(
    input.evidence.presenceSample,
    input.evidence.heartbeatSample,
  );
  const tick = input.evidence.activityTick;
  const tickSsid = tick ? cleanStoredSsid(tick.ssid) : null;
  const now = input.now ?? new Date();
  const openSsid = input.openVisit ? cleanStoredSsid(input.openVisit.ssid) : null;
  const signal = input.inOfficeNowSignal;
  const signalSsid = signal ? cleanStoredSsid(signal.ssid) : null;

  return {
    lastSuccessfulSync: sync
      ? {
          at: sync.createdAt.toISOString(),
          trigger: sync.syncTrigger,
          triggerLabel: sync.syncTrigger ? syncTriggerLabel(sync.syncTrigger) : null,
          deviceId: sync.deviceId,
          serialNumber: syncedDevice?.serialNumber ?? null,
        }
      : null,
    lastDeviceContactAt: latestDeviceContact(input.devices)?.toISOString() ?? null,
    lastWifiSample: wifi ? toWifiSample(wifi, officeSsids) : null,
    lastActivityTick: tick
      ? {
          at: tick.at.toISOString(),
          ssid: tickSsid,
          officeSsid: officeSsidFlag(tickSsid, officeSsids),
          inOffice: tick.inOffice,
        }
      : null,
    minutesSinceLastActivityTick: tick
      ? Math.round((now.getTime() - tick.at.getTime()) / 60000)
      : null,
    openVisit: input.openVisit
      ? {
          startAt: input.openVisit.startAt.toISOString(),
          ssid: openSsid,
          officeSsid: officeSsidFlag(openSsid, officeSsids),
          source: input.openVisit.source,
          sourceLabel: visitSourceLabel(input.openVisit.source),
        }
      : null,
    inOfficeNowRule: IN_OFFICE_NOW_RULE,
    inOfficeNowSignal: signal
      ? {
          at: signal.at.toISOString(),
          ssid: signalSsid,
          officeSsid: officeSsidFlag(signalSsid, officeSsids),
          inOffice: signal.inOffice,
          source: signal.source,
          sourceLabel: agentEvidenceSourceLabel(signal.source),
        }
      : null,
  };
}
