import { dispatchUserAlerts } from "./power-automate-notify";
import { maybeClearOutOfOfficeOnOfficePresence } from "./out-of-office";
import type { IntegrationAlertType } from "./integration-alerts";

export async function handleOfficePresenceDetected(
  userId: string,
  timezone: string,
  at: Date = new Date(),
) {
  const { cleared } = await maybeClearOutOfOfficeOnOfficePresence(userId, timezone, at);
  const types: IntegrationAlertType[] = ["hours_started", "hours_met"];
  if (cleared) {
    types.unshift("ooo_cleared");
  }
  try {
    await dispatchUserAlerts(userId, types);
  } catch {
    console.error("[office-presence] Failed to evaluate notifications");
  }
}
