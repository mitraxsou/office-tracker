import { prisma } from "./db";
import type { IntegrationAlert } from "./integration-alerts";

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

export async function persistInAppAlert(alert: IntegrationAlert): Promise<boolean> {
  const existing = await prisma.inAppNotification.findUnique({
    where: {
      userId_type_dayKey: {
        userId: alert.userId,
        type: alert.type,
        dayKey: alert.dayKey,
      },
    },
  });
  if (existing) return false;
  await createInAppNotification({
    userId: alert.userId,
    type: alert.type,
    dayKey: alert.dayKey,
    message: alert.message,
  });
  return true;
}

export async function persistInAppAlerts(alerts: IntegrationAlert[]) {
  let created = 0;
  for (const alert of alerts) {
    if (await persistInAppAlert(alert)) {
      created += 1;
    }
  }
  return created;
}

export async function createInAppNotification(data: {
  userId: string;
  type: string;
  dayKey: string;
  message: string;
}) {
  return prisma.inAppNotification.create({ data });
}

export async function listUnreadInAppNotifications(
  userId: string,
): Promise<InAppNotificationView[]> {
  const rows = await prisma.inAppNotification.findMany({
    where: { userId, readAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    dayKey: row.dayKey,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function dismissInAppNotification(userId: string, id: string) {
  const row = await prisma.inAppNotification.findFirst({
    where: { id, userId, readAt: null },
  });
  if (!row) return false;
  await prisma.inAppNotification.update({
    where: { id },
    data: { readAt: new Date() },
  });
  return true;
}

/** Soft-read every unread in-app row for the user. Returns how many were updated. */
export async function dismissAllUnreadInAppNotifications(
  userId: string,
): Promise<number> {
  const result = await prisma.inAppNotification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
