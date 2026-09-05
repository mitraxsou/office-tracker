import { prisma } from "./db";
import {
  acknowledgeIntegrationAlerts,
  type IntegrationAlert,
} from "./integration-alerts";

export type InAppNotificationView = {
  id: string;
  type: string;
  dayKey: string;
  message: string;
  createdAt: string;
};

export async function persistInAppAlerts(alerts: IntegrationAlert[]) {
  let created = 0;
  for (const alert of alerts) {
    const existing = await prisma.inAppNotification.findUnique({
      where: {
        userId_type_dayKey: {
          userId: alert.userId,
          type: alert.type,
          dayKey: alert.dayKey,
        },
      },
    });
    if (!existing) {
      await createInAppNotification({
        userId: alert.userId,
        type: alert.type,
        dayKey: alert.dayKey,
        message: alert.message,
      });
      created += 1;
    }
    await acknowledgeIntegrationAlerts(alert.userId, [
      { userId: alert.userId, type: alert.type, dayKey: alert.dayKey },
    ]);
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
