import { VISIT_GAP_MS, isOfficeSsid } from "./constants";
import { validateVisitTimestamps } from "./visit-validation";

/** Event-mode health snapshots can be about an hour apart. */
export const RECOVERED_VISIT_FRESH_MS = 70 * 60 * 1000;

export type OfficeEvidenceTick = {
  at: Date;
  ssid: string | null;
  inOffice?: boolean;
};

export type WifiVisitForRecovery = {
  id: string;
  source: string;
  startAt: Date;
  endAt: Date | null;
};

/** Tick counts as office only with an allowlisted SSID. Empty SSID is a break. */
export function tickCountsAsOffice(tick: OfficeEvidenceTick, allowlist: string[]): boolean {
  if (!tick.ssid) return false;
  return isOfficeSsid(tick.ssid, allowlist);
}

export function contiguousOfficeSegment(params: {
  ticks: OfficeEvidenceTick[];
  now: Date;
  dayStart: Date;
  dayEnd: Date;
  allowlist: string[];
  gapMs?: number;
}): { start: Date; end: Date } | null {
  const gapMs = params.gapMs ?? VISIT_GAP_MS;
  const endBound = Math.min(params.now.getTime(), params.dayEnd.getTime());
  const startBound = params.dayStart.getTime();

  const inWindow = [...params.ticks]
    .filter((tick) => !Number.isNaN(tick.at.getTime()))
    .filter((tick) => tick.at.getTime() >= startBound && tick.at.getTime() <= endBound)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  if (inWindow.length === 0) return null;

  let latestIndex = inWindow.length - 1;
  while (latestIndex >= 0 && !tickCountsAsOffice(inWindow[latestIndex], params.allowlist)) {
    latestIndex -= 1;
  }
  if (latestIndex < 0) return null;

  let earliestIndex = latestIndex;
  for (let i = latestIndex - 1; i >= 0; i--) {
    const older = inWindow[i];
    const newer = inWindow[i + 1];
    if (newer.at.getTime() - older.at.getTime() > gapMs) break;
    if (!tickCountsAsOffice(older, params.allowlist)) break;
    earliestIndex = i;
  }

  return {
    start: inWindow[earliestIndex].at,
    end: inWindow[latestIndex].at,
  };
}

export function earliestContiguousOfficeAt(params: {
  ticks: OfficeEvidenceTick[];
  now: Date;
  dayStart: Date;
  dayEnd: Date;
  allowlist: string[];
  gapMs?: number;
}): Date | null {
  return contiguousOfficeSegment(params)?.start ?? null;
}

export function shouldBackdateWifiVisit(params: {
  source: string;
  currentStartAt: Date;
  recoveredStartAt: Date;
  endAt: Date | null;
  now?: Date;
}): boolean {
  if (params.source === "manual") return false;
  if (params.recoveredStartAt.getTime() >= params.currentStartAt.getTime()) return false;
  if (params.endAt && params.endAt.getTime() < params.recoveredStartAt.getTime()) return false;
  return validateVisitTimestamps(params.recoveredStartAt, params.endAt, params.now) === null;
}

export function shouldCreateRecoveredWifiVisit(params: {
  existing: WifiVisitForRecovery | null;
  recoveredStartAt: Date;
  recoveredEndAt: Date;
  stillInOffice: boolean;
}): boolean {
  if (params.existing) return false;
  if (params.stillInOffice) return true;
  return params.recoveredEndAt.getTime() > params.recoveredStartAt.getTime();
}
