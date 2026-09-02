const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export type LaptopActiveParams = {
  dayStart: Date;
  dayEnd: Date;
  now: Date;
  staleMs: number;
  /** First agent pulse on this calendar day (any SSID). */
  firstHeartbeatAt: Date | null;
  /** Last agent pulse on this calendar day (any SSID). */
  lastHeartbeatAt: Date | null;
  /** Latest pulse overall (extends span on the current day when agent is still running). */
  lastHeartbeatOverall: Date | null;
};

/**
 * Daily laptop active span: first agent pulse to last pulse on the day.
 * On the current day, extends to now while the agent is still pulsing (within stale window).
 * Proxy for laptop on with the Office Pulse agent running; not true OS uptime.
 */
export function laptopActiveMsForDay(params: LaptopActiveParams): number {
  const { firstHeartbeatAt, lastHeartbeatAt } = params;
  if (!firstHeartbeatAt || !lastHeartbeatAt) return 0;

  const dayStartMs = params.dayStart.getTime();
  const dayEndMs = params.dayEnd.getTime();

  const first = Math.max(firstHeartbeatAt.getTime(), dayStartMs);
  let last = Math.min(lastHeartbeatAt.getTime(), dayEndMs);

  const isCurrentDay = params.now.getTime() <= dayEndMs;
  const agentRecent =
    params.lastHeartbeatOverall !== null &&
    params.now.getTime() - params.lastHeartbeatOverall.getTime() <= params.staleMs;

  if (isCurrentDay && agentRecent) {
    last = Math.min(params.now.getTime(), dayEndMs);
  }

  const spanMs = Math.max(0, last - first);
  return Math.min(spanMs, MS_PER_DAY);
}

export function laptopActiveHoursForDay(params: LaptopActiveParams): number {
  return laptopActiveMsForDay(params) / MS_PER_HOUR;
}
