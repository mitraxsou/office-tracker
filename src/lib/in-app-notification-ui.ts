/**
 * Client-safe in-app notification helpers (no Prisma / Node-only imports).
 */

export type InAppNotificationView = {
  id: string;
  type: string;
  dayKey: string;
  message: string;
  createdAt: string;
};

export const IN_APP_NOTIFICATION_TITLES: Record<string, string> = {
  absent: "No Wi-Fi name",
  stale: "Agent not responding",
  behind: "Behind on office hours",
  hours_started: "Office hours started",
  hours_met: "Daily hours target met",
  monthly_snapshot: "Monthly office snapshot",
  ooo_cleared: "Out of office cleared",
  custom: "Message from admin",
};

export function inAppNotificationTitle(type: string): string {
  return IN_APP_NOTIFICATION_TITLES[type] ?? "My Office Pulse";
}

/** Informational alerts that auto-dismiss in the bell after a short delay. */
export const AUTO_DISMISS_IN_APP_TYPES = [
  "hours_started",
  "hours_met",
  "monthly_snapshot",
  "ooo_cleared",
] as const;

export type AutoDismissInAppType = (typeof AUTO_DISMISS_IN_APP_TYPES)[number];

/** Delay before success-style alerts mark themselves read in the bell. */
export const IN_APP_AUTO_DISMISS_MS = 12_000;

export function isAutoDismissInAppType(type: string): boolean {
  return (AUTO_DISMISS_IN_APP_TYPES as readonly string[]).includes(type);
}
