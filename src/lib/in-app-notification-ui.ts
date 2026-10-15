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

/** Informational alerts that auto-dismiss on Today after a short delay. */
export const AUTO_DISMISS_IN_APP_TYPES = [
  "hours_started",
  "hours_met",
  "monthly_snapshot",
  "ooo_cleared",
] as const;

export type AutoDismissInAppType = (typeof AUTO_DISMISS_IN_APP_TYPES)[number];

/** Delay before success-style banners mark themselves read on Today. */
export const IN_APP_AUTO_DISMISS_MS = 12_000;

export function isAutoDismissInAppType(type: string): boolean {
  return (AUTO_DISMISS_IN_APP_TYPES as readonly string[]).includes(type);
}
