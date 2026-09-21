/** Grace window for clock skew on visit and heartbeat timestamps. */
export const CLOCK_SKEW_GRACE_MS = 5 * 60 * 1000;

export function validateVisitTimestamps(
  startAt: Date,
  endAt: Date | null | undefined,
  now = new Date(),
): string | null {
  const maxAllowed = now.getTime() + CLOCK_SKEW_GRACE_MS;
  if (startAt.getTime() > maxAllowed) {
    return "Check-in time cannot be in the future";
  }
  if (endAt && endAt.getTime() > maxAllowed) {
    return "Check-out time cannot be in the future";
  }
  if (endAt && endAt.getTime() < startAt.getTime()) {
    return "Check-out time cannot be before check-in";
  }
  return null;
}
