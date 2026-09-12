import { prisma } from "./db";
import { isOfficeSsid, normalizeSsid } from "./constants";
import { getAppConfig, getUserHoursTarget } from "./app-config";
import { getAgentVersion } from "./agent-version";
import { getDeviceForceAgentUpdate } from "./agent-update";
import {
  agentScriptFilesBaseUrl,
  vercelProtectionBypassSecret,
} from "./agent-download";
import { daySpanMsForDay, dayKeyInTimezone } from "./visits";
import { dayBoundsFromKey } from "./timezone-dates";
import { validateVisitTimestamps } from "./visit-validation";
import { maybeDispatchHeartbeatAlerts } from "./heartbeat-alerts";
import { loadDaySpanContext } from "./heartbeat-service";
import { parseTimestamp, sanitizeSsid, sanitizeSerialNumber } from "./security";

const SUMMARY_MISMATCH_MS = 5 * 60 * 1000;

export type AgentSyncEvent = {
  id: string;
  type: string;
  at?: string;
  ssid?: string | null;
  previousSsid?: string | null;
  localVisitId?: string;
  officeMs?: number;
  dayKey?: string;
  visitCount?: number;
  laptopActiveMs?: number;
};

export type AgentSyncOpenVisit = {
  localVisitId: string;
  startAt: string;
  ssid?: string | null;
};

export type AgentSyncRejected = { id: string; reason: string };

export async function processAgentSync(params: {
  userId: string;
  userTimezone: string;
  deviceId: string;
  serialNumber: string;
  events: AgentSyncEvent[];
  openVisit?: AgentSyncOpenVisit | null;
  appUrl: string;
}) {
  const config = await getAppConfig();
  const allowlist = config.officeSsids;
  const ackedEventIds: string[] = [];
  const rejected: AgentSyncRejected[] = [];
  const visitIds: Record<string, string> = {};

  let lastEventAt: Date | null = null;
  let lastInOffice = false;

  for (const event of params.events) {
    if (!event.id || !event.type) {
      continue;
    }

    const existing = await prisma.agentEvent.findUnique({
      where: { userId_clientEventId: { userId: params.userId, clientEventId: event.id } },
    });
    if (existing) {
      ackedEventIds.push(event.id);
      continue;
    }

    const at = event.at ? parseTimestamp(event.at) : null;
    if (!at && event.type !== "health_ping") {
      rejected.push({ id: event.id, reason: "invalid_timestamp" });
      ackedEventIds.push(event.id);
      await recordAgentEvent(params.userId, params.deviceId, event, "rejected");
      continue;
    }

    const eventAt = at ?? new Date();
    const dayKey = dayKeyInTimezone(eventAt, params.userTimezone);

    try {
      switch (event.type) {
        case "wifi_connected":
        case "wifi_disconnected":
        case "ssid_changed": {
          const ssid = event.ssid ? normalizeSsid(sanitizeSsid(event.ssid) ?? event.ssid) : null;
          const previousSsid = event.previousSsid
            ? normalizeSsid(sanitizeSsid(event.previousSsid) ?? event.previousSsid)
            : null;
          const inOffice = isOfficeSsid(ssid, allowlist);
          await prisma.presenceTransition.create({
            data: {
              userId: params.userId,
              deviceId: params.deviceId,
              type: event.type,
              at: eventAt,
              dayKey,
              ssid,
              previousSsid,
              inOffice,
            },
          });
          lastEventAt = eventAt;
          lastInOffice = inOffice;
          await recordAgentEvent(params.userId, params.deviceId, event, "accepted");
          ackedEventIds.push(event.id);
          break;
        }
        case "visit_start": {
          const ssid = event.ssid ? normalizeSsid(sanitizeSsid(event.ssid) ?? event.ssid) : null;
          if (!isOfficeSsid(ssid, allowlist)) {
            rejected.push({ id: event.id, reason: "ssid_not_allowed" });
            ackedEventIds.push(event.id);
            await recordAgentEvent(params.userId, params.deviceId, event, "rejected");
            break;
          }
          const timestampError = validateVisitTimestamps(eventAt, null);
          if (timestampError) {
            rejected.push({ id: event.id, reason: timestampError });
            ackedEventIds.push(event.id);
            await recordAgentEvent(params.userId, params.deviceId, event, "rejected");
            break;
          }
          const localVisitId = event.localVisitId?.trim();
          if (!localVisitId) {
            rejected.push({ id: event.id, reason: "local_visit_id_required" });
            ackedEventIds.push(event.id);
            await recordAgentEvent(params.userId, params.deviceId, event, "rejected");
            break;
          }

          const existingVisit = await prisma.visit.findFirst({
            where: { userId: params.userId, localVisitId },
          });
          if (existingVisit) {
            visitIds[localVisitId] = existingVisit.id;
            ackedEventIds.push(event.id);
            await recordAgentEvent(params.userId, params.deviceId, event, "accepted");
            break;
          }

          const openOther = await prisma.visit.findFirst({
            where: { userId: params.userId, endAt: null },
            orderBy: { startAt: "desc" },
          });
          if (openOther) {
            await prisma.visit.update({
              where: { id: openOther.id },
              data: { endAt: eventAt },
            });
          }

          const visit = await prisma.visit.create({
            data: {
              userId: params.userId,
              startAt: eventAt,
              source: "wifi",
              ssid,
              localVisitId,
              deviceId: params.deviceId,
            },
          });
          visitIds[localVisitId] = visit.id;
          lastEventAt = eventAt;
          lastInOffice = true;
          await recordAgentEvent(params.userId, params.deviceId, event, "accepted");
          ackedEventIds.push(event.id);
          break;
        }
        case "visit_end": {
          const localVisitId = event.localVisitId?.trim();
          let visit = localVisitId
            ? await prisma.visit.findFirst({
                where: { userId: params.userId, localVisitId },
              })
            : null;
          if (!visit) {
            visit = await prisma.visit.findFirst({
              where: { userId: params.userId, endAt: null, deviceId: params.deviceId },
              orderBy: { startAt: "desc" },
            });
          }
          if (!visit) {
            rejected.push({ id: event.id, reason: "open_visit_not_found" });
            ackedEventIds.push(event.id);
            await recordAgentEvent(params.userId, params.deviceId, event, "rejected");
            break;
          }
          if (visit.endAt) {
            if (localVisitId) visitIds[localVisitId] = visit.id;
            ackedEventIds.push(event.id);
            await recordAgentEvent(params.userId, params.deviceId, event, "accepted");
            break;
          }
          const timestampError = validateVisitTimestamps(visit.startAt, eventAt);
          if (timestampError) {
            rejected.push({ id: event.id, reason: timestampError });
            ackedEventIds.push(event.id);
            await recordAgentEvent(params.userId, params.deviceId, event, "rejected");
            break;
          }
          await prisma.visit.update({
            where: { id: visit.id },
            data: { endAt: eventAt },
          });
          if (localVisitId) visitIds[localVisitId] = visit.id;
          lastEventAt = eventAt;
          lastInOffice = false;
          await recordAgentEvent(params.userId, params.deviceId, event, "accepted");
          ackedEventIds.push(event.id);
          break;
        }
        case "activity_tick": {
          const ssid = event.ssid ? normalizeSsid(sanitizeSsid(event.ssid) ?? event.ssid) : null;
          const inOffice = isOfficeSsid(ssid, allowlist);
          await prisma.activityTick.create({
            data: {
              userId: params.userId,
              deviceId: params.deviceId,
              at: eventAt,
              ssid,
              inOffice,
            },
          });
          lastEventAt = eventAt;
          lastInOffice = inOffice;
          await recordAgentEvent(params.userId, params.deviceId, event, "accepted");
          ackedEventIds.push(event.id);
          break;
        }
        case "daily_summary": {
          const summaryDayKey = event.dayKey?.trim();
          if (!summaryDayKey || !/^\d{4}-\d{2}-\d{2}$/.test(summaryDayKey)) {
            rejected.push({ id: event.id, reason: "invalid_day_key" });
            ackedEventIds.push(event.id);
            await recordAgentEvent(params.userId, params.deviceId, event, "rejected");
            break;
          }
          const serverOfficeMs = await computeServerOfficeMs(
            params.userId,
            summaryDayKey,
            params.userTimezone,
          );
          const agentOfficeMs = typeof event.officeMs === "number" ? event.officeMs : 0;
          const verified = Math.abs(serverOfficeMs - agentOfficeMs) <= SUMMARY_MISMATCH_MS;
          const { start: dayStart, end: dayEnd } = dayBoundsFromKey(summaryDayKey, params.userTimezone);
          const dayVisits = await prisma.visit.findMany({
            where: {
              userId: params.userId,
              startAt: { lte: dayEnd },
              OR: [{ endAt: null }, { endAt: { gte: dayStart } }],
            },
            orderBy: { startAt: "asc" },
          });
          const firstCheckIn = dayVisits[0]?.startAt ?? null;
          const closedEnds = dayVisits.filter((v) => v.endAt).map((v) => v.endAt!);
          const lastCheckOut = closedEnds.length > 0 ? closedEnds[closedEnds.length - 1] : null;

          await prisma.dailySummary.upsert({
            where: { userId_dayKey: { userId: params.userId, dayKey: summaryDayKey } },
            create: {
              userId: params.userId,
              dayKey: summaryDayKey,
              officeMs: serverOfficeMs,
              laptopActiveMs: event.laptopActiveMs ?? 0,
              visitCount: event.visitCount ?? dayVisits.length,
              firstCheckInAt: firstCheckIn,
              lastCheckOutAt: lastCheckOut,
              source: "agent",
              verified,
            },
            update: {
              officeMs: serverOfficeMs,
              laptopActiveMs: event.laptopActiveMs ?? 0,
              visitCount: event.visitCount ?? dayVisits.length,
              firstCheckInAt: firstCheckIn,
              lastCheckOutAt: lastCheckOut,
              verified,
            },
          });
          await recordAgentEvent(params.userId, params.deviceId, event, "accepted");
          ackedEventIds.push(event.id);
          break;
        }
        case "health_ping": {
          await recordAgentEvent(params.userId, params.deviceId, event, "accepted");
          ackedEventIds.push(event.id);
          break;
        }
        default: {
          rejected.push({ id: event.id, reason: "unknown_event_type" });
          ackedEventIds.push(event.id);
          await recordAgentEvent(params.userId, params.deviceId, event, "rejected");
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "event_failed";
      rejected.push({ id: event.id, reason: message });
      ackedEventIds.push(event.id);
      await recordAgentEvent(params.userId, params.deviceId, event, "rejected");
    }
  }

  const openVisitRow = await prisma.visit.findFirst({
    where: { userId: params.userId, endAt: null },
    orderBy: { startAt: "desc" },
  });

  const userRow = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { hoursTarget: true },
  });
  const hoursTarget = await getUserHoursTarget({ hoursTarget: userRow?.hoursTarget ?? null });
  if (lastEventAt) {
    try {
      await maybeDispatchHeartbeatAlerts({
        userId: params.userId,
        timezone: params.userTimezone,
        recordedAt: lastEventAt,
        inOffice: lastInOffice,
        hoursTarget,
      });
    } catch {
      console.error("[agent-sync] Failed to evaluate alerts");
    }
  }

  const forceAgentUpdate = await getDeviceForceAgentUpdate(params.userId, params.serialNumber);
  const appUrl = params.appUrl.replace(/\/$/, "");

  return {
    ok: true,
    ackedEventIds,
    rejected,
    visitIds,
    serverState: {
      inOfficeNow: Boolean(openVisitRow),
      openVisitId: openVisitRow?.id ?? null,
    },
    agentScriptVersion: getAgentVersion(),
    forceAgentUpdate,
    config: {
      ssids: allowlist,
      hoursTarget,
      timezone: params.userTimezone,
      heartbeatIntervalMinutes: config.heartbeatIntervalMinutes,
      agentScriptVersion: getAgentVersion(),
      forceAgentUpdate,
      agentMode: config.agentMode,
      agentScriptFilesBase: appUrl ? agentScriptFilesBaseUrl(appUrl) : null,
      vercelProtectionBypass: vercelProtectionBypassSecret(),
    },
  };
}

async function recordAgentEvent(
  userId: string,
  deviceId: string,
  event: AgentSyncEvent,
  status: string,
) {
  await prisma.agentEvent.upsert({
    where: { userId_clientEventId: { userId, clientEventId: event.id } },
    create: {
      userId,
      deviceId,
      clientEventId: event.id,
      type: event.type,
      payload: event as object,
      status,
    },
    update: { status },
  });
}

async function computeServerOfficeMs(
  userId: string,
  dayKey: string,
  timezone: string,
): Promise<number> {
  const { visits, params } = await loadDaySpanContext(userId, dayKey, timezone);
  return daySpanMsForDay(visits, params);
}

export function parseAgentSyncEvents(raw: unknown): AgentSyncEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: AgentSyncEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.type !== "string") continue;
    events.push({
      id: record.id,
      type: record.type,
      at: typeof record.at === "string" ? record.at : undefined,
      ssid: typeof record.ssid === "string" ? record.ssid : null,
      previousSsid: typeof record.previousSsid === "string" ? record.previousSsid : null,
      localVisitId: typeof record.localVisitId === "string" ? record.localVisitId : undefined,
      officeMs: typeof record.officeMs === "number" ? record.officeMs : undefined,
      dayKey: typeof record.dayKey === "string" ? record.dayKey : undefined,
      visitCount: typeof record.visitCount === "number" ? record.visitCount : undefined,
      laptopActiveMs: typeof record.laptopActiveMs === "number" ? record.laptopActiveMs : undefined,
    });
  }
  return events;
}

export function parseAgentSyncOpenVisit(raw: unknown): AgentSyncOpenVisit | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.localVisitId !== "string" || typeof record.startAt !== "string") {
    return null;
  }
  return {
    localVisitId: record.localVisitId,
    startAt: record.startAt,
    ssid: typeof record.ssid === "string" ? record.ssid : null,
  };
}
