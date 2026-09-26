import { prisma } from "./db";
import { isOfficeSsid, normalizeSsid } from "./constants";

export const VALID_SYNC_TRIGGERS = new Set([
  "resume_wake",
  "ssid_change",
  "activity_tick",
  "queued_events",
  "health_ping",
  "end_of_day",
  "hours_target_met",
  "critical_events",
  "manual",
]);

export type PresenceTimelineEntry = {
  id: string;
  at: string;
  kind: string;
  label: string;
  ssid: string | null;
  previousSsid: string | null;
  inOffice: boolean | null;
  syncTrigger?: string | null;
  gapMinutes?: number | null;
  lastWifiBeforeGap?: string | null;
  deviceId?: string | null;
  source: "presence" | "visit" | "sync" | "activity";
};

export function sanitizeSyncTrigger(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return VALID_SYNC_TRIGGERS.has(trimmed) ? trimmed : null;
}

export function syncTriggerLabel(trigger: string): string {
  switch (trigger) {
    case "resume_wake":
      return "Sync: wake/resume";
    case "ssid_change":
      return "Sync: Wi-Fi change";
    case "activity_tick":
      return "Sync: activity tick";
    case "queued_events":
      return "Sync: queued events";
    case "health_ping":
      return "Sync: health ping";
    case "end_of_day":
      return "Sync: end-of-day diagnostics";
    case "hours_target_met":
      return "Sync: hours target met";
    case "critical_events":
      return "Sync: critical events";
    case "manual":
      return "Sync: manual";
    default:
      return `Sync: ${trigger}`;
  }
}

export function presenceEventLabel(params: {
  kind: string;
  ssid: string | null;
  previousSsid: string | null;
  inOffice: boolean | null;
  officeSsids: string[];
}): string {
  const { kind, ssid, previousSsid, inOffice, officeSsids } = params;
  const prevOffice = isOfficeSsid(previousSsid, officeSsids);
  const currOffice = isOfficeSsid(ssid, officeSsids);

  switch (kind) {
    case "visit_start":
      return "Entered office (Wi-Fi)";
    case "visit_end":
      return "Left office (Wi-Fi)";
    case "wifi_connected":
      return currOffice ? "Connected to office Wi-Fi" : "Connected to Wi-Fi";
    case "wifi_disconnected":
      return prevOffice ? "Disconnected from office Wi-Fi" : "Disconnected from Wi-Fi";
    case "ssid_changed":
      if (prevOffice && !currOffice) {
        return "Switched from office to home Wi-Fi";
      }
      if (!prevOffice && currOffice) {
        return "Switched to office Wi-Fi";
      }
      return "Changed Wi-Fi network";
    case "session_suspend":
      return currOffice ? "Laptop slept on office Wi-Fi" : "Laptop slept / suspended";
    case "session_resume":
      return "Laptop woke / resumed";
    case "activity_tick":
      return inOffice ? "Activity tick (in office)" : "Activity tick";
    case "health_ping":
      return inOffice ? "Health snapshot (in office)" : "Health snapshot";
    case "sync_batch":
      return "Agent sync";
    default:
      return kind;
  }
}

function entrySortKey(entry: PresenceTimelineEntry): number {
  return Date.parse(entry.at);
}

export function sortPresenceTimelineEntries(
  entries: PresenceTimelineEntry[],
): PresenceTimelineEntry[] {
  return [...entries].sort((a, b) => entrySortKey(b) - entrySortKey(a));
}

function timelineDedupeKey(entry: PresenceTimelineEntry): string {
  const atKey = entry.at.slice(0, 19);
  return `${entry.source}:${entry.kind}:${atKey}`;
}

export function mergePresenceTimelineEntries(
  ...groups: PresenceTimelineEntry[]
): PresenceTimelineEntry[] {
  const seenIds = new Set<string>();
  const seenLogical = new Set<string>();
  const merged: PresenceTimelineEntry[] = [];
  for (const entry of groups) {
    if (seenIds.has(entry.id)) continue;
    const logical = timelineDedupeKey(entry);
    if (seenLogical.has(logical)) continue;
    seenIds.add(entry.id);
    seenLogical.add(logical);
    merged.push(entry);
  }
  return sortPresenceTimelineEntries(merged);
}

const GAP_WIFI_LOOKBACK_BUFFER_MS = 15 * 60 * 1000;

export function pickLastWifiBeforeGap(params: {
  gapMs: number;
  beforeMs: number;
  lastSsidFromAgent?: string | null;
  suspend?: { atMs: number; ssid: string | null } | null;
  lastActivity?: { atMs: number; ssid: string | null } | null;
  lastTransition?: { ssid: string | null; previousSsid: string | null } | null;
}): string | null {
  const { gapMs, beforeMs } = params;
  const maxDelta = gapMs + GAP_WIFI_LOOKBACK_BUFFER_MS;

  const fromAgent = params.lastSsidFromAgent
    ? normalizeSsid(params.lastSsidFromAgent)
    : null;
  if (fromAgent) return fromAgent;

  if (params.suspend?.ssid) {
    const delta = beforeMs - params.suspend.atMs;
    if (delta >= 0 && delta <= maxDelta) {
      return normalizeSsid(params.suspend.ssid);
    }
  }

  if (params.lastActivity?.ssid) {
    const delta = beforeMs - params.lastActivity.atMs;
    if (delta >= 0 && delta <= maxDelta) {
      return normalizeSsid(params.lastActivity.ssid);
    }
  }

  if (params.lastTransition?.ssid) {
    return normalizeSsid(params.lastTransition.ssid);
  }
  if (params.lastTransition?.previousSsid) {
    return normalizeSsid(params.lastTransition.previousSsid);
  }
  return null;
}

async function findLastWifiBefore(
  userId: string,
  before: Date,
  gapMs: number,
): Promise<string | null> {
  const beforeMs = before.getTime();
  const since = new Date(beforeMs - gapMs);

  const [suspend, tick, transition] = await Promise.all([
    prisma.presenceTransition.findFirst({
      where: { userId, type: "session_suspend", at: { lte: before } },
      orderBy: { at: "desc" },
      select: { ssid: true, at: true },
    }),
    prisma.activityTick.findFirst({
      where: { userId, at: { lt: before } },
      orderBy: { at: "desc" },
      select: { ssid: true, at: true },
    }),
    prisma.presenceTransition.findFirst({
      where: { userId, at: { gte: since, lt: before } },
      orderBy: { at: "desc" },
      select: { ssid: true, previousSsid: true },
    }),
  ]);

  return pickLastWifiBeforeGap({
    gapMs,
    beforeMs,
    suspend: suspend
      ? { atMs: suspend.at.getTime(), ssid: suspend.ssid ? normalizeSsid(suspend.ssid) : null }
      : null,
    lastActivity: tick
      ? { atMs: tick.at.getTime(), ssid: tick.ssid ? normalizeSsid(tick.ssid) : null }
      : null,
    lastTransition: transition
      ? {
          ssid: transition.ssid ? normalizeSsid(transition.ssid) : null,
          previousSsid: transition.previousSsid
            ? normalizeSsid(transition.previousSsid)
            : null,
        }
      : null,
  });
}

export async function getUserPresenceTimeline(
  userId: string,
  days: number,
  timezone: string,
  officeSsids: string[],
  options?: { dayKey?: string | null },
): Promise<{
  entries: PresenceTimelineEntry[];
  days: number;
  timezone: string;
  dayKey: string | null;
  lastWifiAtClose: string | null;
}> {
  const dayKey = options?.dayKey?.trim() || null;
  let since: Date;
  let until: Date | null = null;
  let clampedDays = Math.min(30, Math.max(1, days));

  if (dayKey && /^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    const { dayBoundsFromKey } = await import("./timezone-dates");
    const bounds = dayBoundsFromKey(dayKey, timezone);
    since = bounds.start;
    until = bounds.end;
    clampedDays = 1;
  } else {
    since = new Date(Date.now() - clampedDays * 24 * 60 * 60 * 1000);
  }

  const atFilter = until
    ? { gte: since, lte: until }
    : { gte: since };

  const [transitions, visits, syncEvents, activityTicks, resumeAgentEvents] = await Promise.all([
    prisma.presenceTransition.findMany({
      where: { userId, at: atFilter },
      orderBy: { at: "desc" },
      select: {
        id: true,
        type: true,
        at: true,
        ssid: true,
        previousSsid: true,
        inOffice: true,
        deviceId: true,
      },
    }),
    prisma.visit.findMany({
      where: {
        userId,
        startAt: atFilter,
        source: "wifi",
      },
      orderBy: { startAt: "desc" },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        ssid: true,
        deviceId: true,
      },
    }),
    prisma.agentEvent.findMany({
      where: {
        userId,
        type: "sync_batch",
        createdAt: atFilter,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        createdAt: true,
        payload: true,
        deviceId: true,
      },
    }),
    prisma.activityTick.findMany({
      where: { userId, at: atFilter },
      orderBy: { at: "desc" },
      take: dayKey ? 800 : 200,
      select: {
        id: true,
        at: true,
        ssid: true,
        inOffice: true,
        deviceId: true,
      },
    }),
    prisma.agentEvent.findMany({
      where: {
        userId,
        type: "session_resume",
        createdAt: atFilter,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        payload: true,
        deviceId: true,
      },
    }),
  ]);

  type ResumeAgentMeta = { gapMinutes: number; lastSsidBeforeGap?: string | null };
  const resumeMetaByTime = new Map<number, ResumeAgentMeta>();
  for (const event of resumeAgentEvents) {
    const payload = event.payload as {
      gapMinutes?: number;
      at?: string;
      lastSsidBeforeGap?: string;
    } | null;
    if (typeof payload?.gapMinutes !== "number") continue;
    const key = event.createdAt.getTime();
    resumeMetaByTime.set(key, {
      gapMinutes: payload.gapMinutes,
      lastSsidBeforeGap: payload.lastSsidBeforeGap ?? null,
    });
  }

  function resumeMetaNear(at: Date): ResumeAgentMeta | null {
    const target = at.getTime();
    for (const [key, meta] of resumeMetaByTime) {
      if (Math.abs(key - target) <= 120_000) return meta;
    }
    return null;
  }

  function gapMinutesNear(at: Date): number | null {
    return resumeMetaNear(at)?.gapMinutes ?? null;
  }

  const presenceEntries: PresenceTimelineEntry[] = [];
  for (const row of transitions) {
    const ssid = row.ssid ? normalizeSsid(row.ssid) : null;
    const previousSsid = row.previousSsid ? normalizeSsid(row.previousSsid) : null;
    let gapMinutes: number | null = null;
    let lastWifiBeforeGap: string | null = null;

    if (row.type === "session_resume") {
      const meta = resumeMetaNear(row.at);
      const gap = meta?.gapMinutes ?? null;
      if (gap != null && gap >= 15) {
        gapMinutes = gap;
        const fromAgent = meta?.lastSsidBeforeGap
          ? normalizeSsid(meta.lastSsidBeforeGap)
          : null;
        lastWifiBeforeGap =
          fromAgent ?? (await findLastWifiBefore(userId, row.at, gap * 60 * 1000));
      }
    }

    presenceEntries.push({
      id: `presence-${row.id}`,
      at: row.at.toISOString(),
      kind: row.type,
      label: presenceEventLabel({
        kind: row.type,
        ssid,
        previousSsid,
        inOffice: row.inOffice,
        officeSsids,
      }),
      ssid,
      previousSsid,
      inOffice: row.inOffice,
      gapMinutes,
      lastWifiBeforeGap,
      deviceId: row.deviceId,
      source: "presence",
    });
  }

  const visitEntries: PresenceTimelineEntry[] = [];
  for (const visit of visits) {
    const ssid = visit.ssid ? normalizeSsid(visit.ssid) : null;
    const inOffice = isOfficeSsid(ssid, officeSsids);
    visitEntries.push({
      id: `visit-start-${visit.id}`,
      at: visit.startAt.toISOString(),
      kind: "visit_start",
      label: presenceEventLabel({
        kind: "visit_start",
        ssid,
        previousSsid: null,
        inOffice,
        officeSsids,
      }),
      ssid,
      previousSsid: null,
      inOffice,
      deviceId: visit.deviceId,
      source: "visit",
    });
    if (visit.endAt) {
      visitEntries.push({
        id: `visit-end-${visit.id}`,
        at: visit.endAt.toISOString(),
        kind: "visit_end",
        label: presenceEventLabel({
          kind: "visit_end",
          ssid,
          previousSsid: null,
          inOffice: false,
          officeSsids,
        }),
        ssid,
        previousSsid: null,
        inOffice: null,
        deviceId: visit.deviceId,
        source: "visit",
      });
    }
  }

  const syncEntries: PresenceTimelineEntry[] = syncEvents.map((row) => {
    const payload = row.payload as {
      syncTrigger?: string;
      eventCount?: number;
      eventTypes?: string[];
    } | null;
    const trigger = payload?.syncTrigger ?? null;
    return {
      id: `sync-${row.id}`,
      at: row.createdAt.toISOString(),
      kind: "sync_batch",
      label: trigger ? syncTriggerLabel(trigger) : "Agent sync",
      ssid: null,
      previousSsid: null,
      inOffice: null,
      syncTrigger: trigger,
      deviceId: row.deviceId,
      source: "sync",
    };
  });

  const activityEntries: PresenceTimelineEntry[] = activityTicks.map((row) => {
    const ssid = row.ssid ? normalizeSsid(row.ssid) : null;
    return {
      id: `activity-${row.id}`,
      at: row.at.toISOString(),
      kind: "activity_tick",
      label: presenceEventLabel({
        kind: "activity_tick",
        ssid,
        previousSsid: null,
        inOffice: row.inOffice,
        officeSsids,
      }),
      ssid,
      previousSsid: null,
      inOffice: row.inOffice,
      deviceId: row.deviceId,
      source: "activity",
    };
  });

  const entries = mergePresenceTimelineEntries(
    ...presenceEntries,
    ...visitEntries,
    ...syncEntries,
    ...activityEntries,
  );

  const resumeWithGap = entries.find(
    (e) => e.kind === "session_resume" && e.lastWifiBeforeGap,
  );
  const lastWifiAtClose = resumeWithGap?.lastWifiBeforeGap ?? null;

  return {
    entries,
    days: clampedDays,
    timezone,
    dayKey,
    lastWifiAtClose,
  };
}
