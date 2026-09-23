import { wasAlertDispatchedToday } from "./alert-dispatch";
import { getQuickMetTarget } from "./heartbeat-service";
import type { IntegrationAlertType } from "./integration-alerts";
import { maybeClearOutOfOfficeOnOfficePresence } from "./out-of-office";
import { dispatchUserAlerts } from "./power-automate-notify";
import { dayKeyInTimezone } from "./timezone-dates";

/**
 * Pure selection logic for heartbeat-triggered alerts (unit tested).
 *
 * Once-per-day is enforced by the AlertDispatch row, not by "is this the first
 * presence today". Sync writes the visit before alerts are evaluated, so any
 * prior-presence test always sees today's own visit and never fires.
 */
export function selectHeartbeatAlertTypes(input: {
  inOffice: boolean;
  oooCleared: boolean;
  metTarget: boolean;
  hoursStartedSent: boolean;
  hoursMetSent: boolean;
  monthlySnapshotSent: boolean;
}): IntegrationAlertType[] {
  const types: IntegrationAlertType[] = [];
  if (input.oooCleared) {
    types.push("ooo_cleared");
  }
  if (input.inOffice && !input.hoursStartedSent) {
    types.push("hours_started");
  }
  if (input.inOffice && !input.monthlySnapshotSent) {
    types.push("monthly_snapshot");
  }
  if (!input.hoursMetSent && input.metTarget) {
    types.push("hours_met");
  }
  return types;
}

/**
 * Evaluate heartbeat-driven alerts only when state may have changed.
 * Skips the heavy evaluateUserAlerts path on routine beats.
 */
export async function maybeDispatchHeartbeatAlerts(params: {
  userId: string;
  timezone: string;
  recordedAt: Date;
  inOffice: boolean;
  hoursTarget: number;
}) {
  const { userId, timezone, recordedAt, inOffice, hoursTarget } = params;
  const dayKey = dayKeyInTimezone(recordedAt, timezone);

  let oooCleared = false;
  if (inOffice) {
    const result = await maybeClearOutOfOfficeOnOfficePresence(userId, timezone, recordedAt);
    oooCleared = result.cleared;
  }

  const [hoursStartedSent, hoursMetSent, monthlySnapshotSent] = await Promise.all([
    wasAlertDispatchedToday(userId, "hours_started", dayKey),
    wasAlertDispatchedToday(userId, "hours_met", dayKey),
    wasAlertDispatchedToday(userId, "monthly_snapshot", dayKey),
  ]);

  let metTarget = false;
  if (!hoursMetSent) {
    metTarget = await getQuickMetTarget(userId, timezone, hoursTarget);
  }

  const types = selectHeartbeatAlertTypes({
    inOffice,
    oooCleared,
    metTarget,
    hoursStartedSent,
    hoursMetSent,
    monthlySnapshotSent,
  });

  if (types.length > 0) {
    await dispatchUserAlerts(userId, types);
  }
}
