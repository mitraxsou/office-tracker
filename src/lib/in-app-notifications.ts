import { prisma } from "./db";
import type { IntegrationAlert } from "./integration-alerts";
import type { InAppNotificationView } from "./in-app-notification-ui";
import { dayKeyInTimezone } from "./timezone-dates";

export {
  AUTO_DISMISS_IN_APP_TYPES,
  IN_APP_AUTO_DISMISS_MS,
  IN_APP_NOTIFICATION_TITLES,
  inAppNotificationTitle,
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

/** Soft-read unread rows that are not for the given calendar day. */
export async function dismissUnreadInAppNotificationsNotForDay(
  userId: string,
  todayDayKey: string,
): Promise<number> {
  const result = await prisma.inAppNotification.updateMany({
    where: {
      userId,
      readAt: null,
      NOT: { dayKey: todayDayKey },
    },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function listUnreadInAppNotifications(
  userId: string,
  options?: { dayKey?: string },
): Promise<InAppNotificationView[]> {
  const rows = await prisma.inAppNotification.findMany({
    where: {
      userId,
      readAt: null,
      ...(options?.dayKey ? { dayKey: options.dayKey } : {}),
    },
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

/**
 * Prune stale unread (other days), then return today's unread for the header bell.
 */
export async function listTodayUnreadInAppNotifications(
  userId: string,
  timezone: string,
): Promise<InAppNotificationView[]> {
  const todayDayKey = dayKeyInTimezone(new Date(), timezone);
  await dismissUnreadInAppNotificationsNotForDay(userId, todayDayKey);
  return listUnreadInAppNotifications(userId, { dayKey: todayDayKey });
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
