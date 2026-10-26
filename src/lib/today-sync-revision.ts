import { prisma } from "@/lib/db";
import { latestDeviceLastSeenAt } from "@/lib/activity-signal";

export type TodaySyncRevisionInput = {
  lastSyncedAt: Date | string | null;
  lastSignalAt: Date | string | null;
  lastSignalInOffice: boolean | null;
  openVisitId: string | null;
  openVisitStartAt: Date | string | null;
  latestClosedVisitEndAt: Date | string | null;
};

function toIso(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

/**
 * Stable fingerprint of agent/server presence state for Today auto-refresh.
 * Must not include wall-clock "now" / asOf - those change every request.
 */
export function buildTodaySyncRevision(input: TodaySyncRevisionInput): string {
  const inOffice =
    input.lastSignalInOffice === null || input.lastSignalInOffice === undefined
      ? ""
      : input.lastSignalInOffice
        ? "1"
        : "0";
  return [
    toIso(input.lastSyncedAt),
    toIso(input.lastSignalAt),
    inOffice,
    input.openVisitId?.trim() ?? "",
    toIso(input.openVisitStartAt),
    toIso(input.latestClosedVisitEndAt),
  ].join("|");
}

type DeviceLastSeen = { lastSeenAt: Date | null };

/**
 * Cheap DB reads for Today revision (no getTodaySummary side effects).
 */
export async function loadTodaySyncRevisionForUser(
  userId: string,
  devices: DeviceLastSeen[],
): Promise<string> {
  const lastSyncedAt = latestDeviceLastSeenAt(devices);

  const [openVisit, latestClosed, latestTick, latestHeartbeat] = await Promise.all([
    prisma.visit.findFirst({
      where: { userId, endAt: null },
      orderBy: { startAt: "desc" },
      select: { id: true, startAt: true },
    }),
    prisma.visit.findFirst({
      where: { userId, endAt: { not: null } },
      orderBy: { endAt: "desc" },
      select: { endAt: true },
    }),
    prisma.activityTick.findFirst({
      where: { userId },
      orderBy: { at: "desc" },
      select: { at: true, inOffice: true },
    }),
    prisma.heartbeat.findFirst({
      where: { userId },
      orderBy: { recordedAt: "desc" },
      select: { recordedAt: true, inOffice: true },
    }),
  ]);

  let lastSignalAt: Date | null = null;
  let lastSignalInOffice: boolean | null = null;
  const tickAt = latestTick?.at ?? null;
  const heartbeatAt = latestHeartbeat?.recordedAt ?? null;
  if (tickAt && heartbeatAt) {
    if (tickAt.getTime() >= heartbeatAt.getTime()) {
      lastSignalAt = tickAt;
      lastSignalInOffice = latestTick!.inOffice;
    } else {
      lastSignalAt = heartbeatAt;
      lastSignalInOffice = latestHeartbeat!.inOffice;
    }
  } else if (tickAt) {
    lastSignalAt = tickAt;
    lastSignalInOffice = latestTick!.inOffice;
  } else if (heartbeatAt) {
    lastSignalAt = heartbeatAt;
    lastSignalInOffice = latestHeartbeat!.inOffice;
  }

  return buildTodaySyncRevision({
    lastSyncedAt,
    lastSignalAt,
    lastSignalInOffice,
    openVisitId: openVisit?.id ?? null,
    openVisitStartAt: openVisit?.startAt ?? null,
    latestClosedVisitEndAt: latestClosed?.endAt ?? null,
  });
}
