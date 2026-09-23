import { filterUndispatchedAlertTypes } from "./alert-dispatch";
import type { IntegrationAlertType } from "./integration-alerts";
import { maybeClearOutOfOfficeOnOfficePresence } from "./out-of-office";
import { dispatchUserAlerts } from "./power-automate-notify";
import { dayKeyInTimezone } from "./timezone-dates";

export async function handleOfficePresenceDetected(
  userId: string,
  timezone: string,
  at: Date = new Date(),
) {
  const dayKey = dayKeyInTimezone(at, timezone);
  const { cleared } = await maybeClearOutOfOfficeOnOfficePresence(userId, timezone, at);
  const candidateTypes: IntegrationAlertType[] = [
    "hours_started",
    "monthly_snapshot",
    "hours_met",
  ];
  if (cleared) {
    candidateTypes.unshift("ooo_cleared");
  }
  const types = await filterUndispatchedAlertTypes(userId, dayKey, candidateTypes);
  if (types.length === 0) return;

  try {
    await dispatchUserAlerts(userId, types);
  } catch {
    console.error("[office-presence] Failed to evaluate notifications");
  }
}
