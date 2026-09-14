import { isCurrentCalendarDay } from "./timezone-dates";

const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export type UptimeSignalKind = "tick" | "session_resume";

export type UptimeSignal = {
  at: Date;
  kind: UptimeSignalKind;
};

export type LaptopActiveParams = {
  dayStart: Date;
  dayEnd: Date;
  now: Date;
  staleMs: number;
  /** Agent-reported uptime for the day (ms), when available. */
  agentLaptopActiveMs: number | null;
  /** First agent switch-on of the day from the agent. */
  agentFirstAgentOnAt: Date | null;
  /** Fallback when the agent has not reported uptime yet. */
  uptimeSignals: UptimeSignal[];
  lastSignalOverall: Date | null;
};

export type LaptopActiveResult = {
  ms: number;
  firstAgentOnAt: Date | null;
};

/**
 * Sum of agent uptime sessions (activity ticks and wake/resume), not first-to-last span.
 * Prefers agent-reported laptopActiveMs when the device syncs it.
 */
export function resolveLaptopActiveForDay(params: LaptopActiveParams): LaptopActiveResult {
  const isCurrentDay = isCurrentCalendarDay(params.dayStart, params.dayEnd, params.now);
  const agentRecent =
    params.lastSignalOverall !== null &&
    params.now.getTime() - params.lastSignalOverall.getTime() <= params.staleMs;

  if (params.agentLaptopActiveMs != null && params.agentLaptopActiveMs > 0) {
    let ms = params.agentLaptopActiveMs;
    if (isCurrentDay && agentRecent && params.lastSignalOverall) {
      ms += Math.max(0, params.now.getTime() - params.lastSignalOverall.getTime());
    }
    return {
      ms: Math.min(Math.max(0, ms), MS_PER_DAY),
      firstAgentOnAt: params.agentFirstAgentOnAt,
    };
  }

  const ms = agentUptimeMsFromSignals(params.uptimeSignals, {
    dayStart: params.dayStart,
    dayEnd: params.dayEnd,
    now: params.now,
    staleMs: params.staleMs,
    isCurrentDay,
    lastSignalOverall: params.lastSignalOverall,
  });

  const firstFromSignals = firstSignalOnDay(params.uptimeSignals, params.dayStart, params.dayEnd);
  return {
    ms,
    firstAgentOnAt: params.agentFirstAgentOnAt ?? firstFromSignals,
  };
}

export function agentUptimeMsFromSignals(
  signals: UptimeSignal[],
  params: {
    dayStart: Date;
    dayEnd: Date;
    now: Date;
    staleMs: number;
    isCurrentDay: boolean;
    lastSignalOverall: Date | null;
  },
): number {
  const dayStartMs = params.dayStart.getTime();
  const dayEndMs = params.dayEnd.getTime();
  const inDay = signals
    .filter((s) => s.at.getTime() >= dayStartMs && s.at.getTime() <= dayEndMs)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  if (inDay.length === 0) return 0;

  let total = 0;
  let sessionStart: Date | null = null;
  let lastEventAt: Date | null = null;

  for (const signal of inDay) {
    const t = signal.at.getTime();
    if (lastEventAt !== null && t - lastEventAt.getTime() > params.staleMs) {
      if (sessionStart && lastEventAt) {
        total += Math.max(0, lastEventAt.getTime() - sessionStart.getTime());
      }
      sessionStart = null;
    }
    if (!sessionStart) {
      sessionStart = signal.at;
    }
    lastEventAt = signal.at;
  }

  if (sessionStart && lastEventAt) {
    let endMs = lastEventAt.getTime();
    const agentRecent =
      params.isCurrentDay &&
      params.lastSignalOverall !== null &&
      params.now.getTime() - params.lastSignalOverall.getTime() <= params.staleMs;
    if (agentRecent) {
      endMs = Math.min(params.now.getTime(), dayEndMs);
    }
    total += Math.max(0, endMs - sessionStart.getTime());
  }

  return Math.min(Math.max(0, total), MS_PER_DAY);
}

function firstSignalOnDay(signals: UptimeSignal[], dayStart: Date, dayEnd: Date): Date | null {
  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayEnd.getTime();
  for (const signal of signals) {
    const t = signal.at.getTime();
    if (t >= dayStartMs && t <= dayEndMs) return signal.at;
  }
  return null;
}

/** @deprecated Use resolveLaptopActiveForDay. Kept for tests migrating from span-based logic. */
export function laptopActiveMsForDay(params: {
  dayStart: Date;
  dayEnd: Date;
  now: Date;
  staleMs: number;
  firstHeartbeatAt: Date | null;
  lastHeartbeatAt: Date | null;
  lastHeartbeatOverall: Date | null;
}): number {
  const signals: UptimeSignal[] = [];
  if (params.firstHeartbeatAt && params.lastHeartbeatAt) {
    signals.push({ at: params.firstHeartbeatAt, kind: "tick" });
    if (params.lastHeartbeatAt.getTime() !== params.firstHeartbeatAt.getTime()) {
      signals.push({ at: params.lastHeartbeatAt, kind: "tick" });
    }
  }
  return agentUptimeMsFromSignals(signals, {
    dayStart: params.dayStart,
    dayEnd: params.dayEnd,
    now: params.now,
    staleMs: params.staleMs,
    isCurrentDay: isCurrentCalendarDay(params.dayStart, params.dayEnd, params.now),
    lastSignalOverall: params.lastHeartbeatOverall,
  });
}

export function laptopActiveHoursForDay(params: LaptopActiveParams): number {
  return resolveLaptopActiveForDay(params).ms / MS_PER_HOUR;
}
