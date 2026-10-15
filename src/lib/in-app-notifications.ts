import { prisma } from "./db";
import type { IntegrationAlert } from "./integration-alerts";
import type { InAppNotificationView } from "./in-app-notification-ui";

export {
  AUTO_DISMISS_IN_APP_TYPES,
  IN_APP_AUTO_DISMISS_MS,
  isAutoDismissInAppType,
  type AutoDismissInAppType,
  type InAppNotificationView,
} from "./in-app-notification-ui";

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
