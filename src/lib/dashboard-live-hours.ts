/**
 * One live day total for the Today office-hours tile and the Today's office
 * time card. Server liveHours already follows first check-in through last
 * check-out (gaps count) and, while still in office, through the snapshot
 * clock. The browser only adds time after that snapshot.
 *
 * Do not add (now - lastConfirmedOfficeAt) on top of confirmedHours. The
 * confirmed span can already end after the last pulse (visit end, or a later
 * office snapshot). Adding the pulse gap again inflates the total.
 *
 * When checkout is still missing or only inferred, liveHours already runs
 * through the snapshot clock. Yellow is that unconfirmed tail. A later agent
 * visit_end, or a user or admin checkout, replaces it.
 */

export type DashboardOfficeTimeInput = {
  /** liveOfficeMsForDay at asOf, in hours. */
  liveHours: number;
  /** daySpanMsForDay at asOf, in hours. Confirmed segment, not the live tick. */
  confirmedHours: number;
  inOfficeNow: boolean;
  /**
   * No agent, manual, or admin checkout yet. Keep the tail after the last
   * confirmed office signal as yellow, even when In office now is No.
   */
  estimateUnconfirmedTail?: boolean;
  /** Server clock used to compute liveHours and confirmedHours. */
  asOf?: Date | string | null;
};

const DEFINITIVE_CHECKOUT_SOURCES = new Set(["agent", "manual", "admin"]);

/** Agent, manual, or admin checkout. Inferred silence closes do not count. */
export function isDefinitiveCheckoutSource(
  endSource: string | null | undefined,
): boolean {
  return DEFINITIVE_CHECKOUT_SOURCES.has(endSource ?? "");
}

/**
 * Same calendar day, and the latest visit is still open or was only inferred
 * from a silent laptop. A real checkout stops the yellow tail.
 */
export function shouldEstimateUnconfirmedOfficeTail(input: {
  isCurrentDay: boolean;
  visits: Array<{ endAt: Date | null; endSource?: string | null }>;
}): boolean {
  if (!input.isCurrentDay || input.visits.length === 0) return false;
  if (input.visits.some((visit) => visit.endAt === null)) return true;

  let latestEnd = 0;
  let latestSource: string | null = null;
  for (const visit of input.visits) {
    if (!visit.endAt) continue;
    const end = visit.endAt.getTime();
    if (end >= latestEnd) {
      latestEnd = end;
      latestSource = visit.endSource ?? null;
    }
  }
  if (latestEnd === 0) return true;
  return !isDefinitiveCheckoutSource(latestSource);
}

export type DashboardOfficeTimeSegments = {
  liveHours: number;
  confirmedHours: number;
  estimatedHours: number;
};

function hoursOrZero(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dashboardLiveOfficeHours(
  input: DashboardOfficeTimeInput,
  now: Date,
): number {
  const base = Math.max(hoursOrZero(input.liveHours), hoursOrZero(input.confirmedHours));
  if (!input.inOfficeNow && !input.estimateUnconfirmedTail) return base;
  const asOf = asDate(input.asOf);
  if (!asOf) return base;
  const extra = Math.max(0, now.getTime() - asOf.getTime()) / (1000 * 60 * 60);
  return base + extra;
}

/**
 * Orange is the confirmed span. Yellow is the tail after that span while the
 * visit is still open, or while checkout is only inferred. A real checkout
 * makes the day total all confirmed.
 */
export function dashboardOfficeTimeSegments(
  input: DashboardOfficeTimeInput,
  now: Date,
): DashboardOfficeTimeSegments {
  const liveHours = dashboardLiveOfficeHours(input, now);
  if (!input.inOfficeNow && !input.estimateUnconfirmedTail) {
    return { liveHours, confirmedHours: liveHours, estimatedHours: 0 };
  }
  const confirmedHours = Math.min(hoursOrZero(input.confirmedHours), liveHours);
  return {
    liveHours,
    confirmedHours,
    estimatedHours: Math.max(0, liveHours - confirmedHours),
  };
}
