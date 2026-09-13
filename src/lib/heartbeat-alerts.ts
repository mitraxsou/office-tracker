import { wasAlertDispatchedToday } from "./alert-dispatch";
import { prisma } from "./db";
import { getQuickMetTarget } from "./heartbeat-service";
import type { IntegrationAlertType } from "./integration-alerts";
import { maybeClearOutOfOfficeOnOfficePresence } from "./out-of-office";
import { dispatchUserAlerts } from "./power-automate-notify";
import { dayBoundsFromKey, dayKeyInTimezone } from "./timezone-dates";

/** Pure selection logic for heartbeat-triggered alerts (unit tested). */
export function selectHeartbeatAlertTypes(input: {
  inOffice: boolean;
  firstInOfficeToday: boolean;
  oooCleared: boolean;
  metTarget: boolean;
  hoursStartedSent: boolean;
  hoursMetSent: boolean;
}): IntegrationAlertType[] {
  const types: IntegrationAlertType[] = [];
  if (input.oooCleared) {
    types.push("ooo_cleared");
  }
  if (input.inOffice && input.firstInOfficeToday && !input.hoursStartedSent) {
    types.push("hours_started");
  }
  if (!input.hoursMetSent && input.metTarget) {
    types.push("hours_met");
  }
  return types;
}

async function isFirstInOfficePresenceToday(
  userId: string,
  timezone: string,
  recordedAt: Date,
  inOffice: boolean,
): Promise<boolean> {
  if (!inOffice) return false;
  const dayKey = dayKeyInTimezone(recordedAt, timezone);
  const { start: dayStart } = dayBoundsFromKey(dayKey, timezone);
  const [priorHeartbeats, priorVisits] = await Promise.all([
    prisma.heartbeat.count({
      where: {
        userId,
        inOffice: true,
        recordedAt: { gte: dayStart, lt: recordedAt },
      },
    }),
    prisma.visit.count({
      where: {
        userId,
        startAt: { gte: dayStart, lt: recordedAt },
      },
    }),
  ]);
  return priorHeartbeats === 0 && priorVisits === 0;
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

  const [firstInOfficeToday, hoursStartedSent, hoursMetSent] = await Promise.all([
    isFirstInOfficePresenceToday(userId, timezone, recordedAt, inOffice),
    wasAlertDispatchedToday(userId, "hours_started", dayKey),
    wasAlertDispatchedToday(userId, "hours_met", dayKey),
  ]);

  let metTarget = false;
  if (!hoursMetSent) {
    metTarget = await getQuickMetTarget(userId, timezone, hoursTarget);
  }

  const types = selectHeartbeatAlertTypes({
    inOffice,
    firstInOfficeToday,
    oooCleared,
    metTarget,
    hoursStartedSent,
    hoursMetSent,
  });

  if (types.length > 0) {
    await dispatchUserAlerts(userId, types);
  }
}
