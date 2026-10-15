/**
 * One live day total for the Today office-hours tile and the Today's office
 * time card. Server liveHours already follows first check-in through last
 * check-out (gaps count) and, while still in office, through the snapshot
 * clock. The browser only adds time after that snapshot.
 *
 * Do not add (now - lastConfirmedOfficeAt) on top of confirmedHours. The
 * confirmed span can already end after the last pulse (visit end, or a later
 * office snapshot). Adding the pulse gap again inflates the total.
 */

export type DashboardOfficeTimeInput = {
  /** liveOfficeMsForDay at asOf, in hours. */
  liveHours: number;
  /** daySpanMsForDay at asOf, in hours. Confirmed segment, not the live tick. */
  confirmedHours: number;
  inOfficeNow: boolean;
  /** Server clock used to compute liveHours and confirmedHours. */
  asOf?: Date | string | null;
};

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
  if (!input.inOfficeNow) return base;
  const asOf = asDate(input.asOf);
  if (!asOf) return base;
  const extra = Math.max(0, now.getTime() - asOf.getTime()) / (1000 * 60 * 60);
  return base + extra;
}

/**
 * Orange is the confirmed span. Yellow is only the in-office tail after that
 * span. After leaving, the finalized day total is all confirmed.
 */
export function dashboardOfficeTimeSegments(
  input: DashboardOfficeTimeInput,
  now: Date,
): DashboardOfficeTimeSegments {
  const liveHours = dashboardLiveOfficeHours(input, now);
  if (!input.inOfficeNow) {
    return { liveHours, confirmedHours: liveHours, estimatedHours: 0 };
  }
  const confirmedHours = Math.min(hoursOrZero(input.confirmedHours), liveHours);
  return {
    liveHours,
    confirmedHours,
    estimatedHours: Math.max(0, liveHours - confirmedHours),
  };
}
