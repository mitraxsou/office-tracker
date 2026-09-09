import { prisma } from "./db";
import type { IntegrationAlertType } from "./integration-alerts";

export async function wasAlertDispatchedToday(
  userId: string,
  type: IntegrationAlertType,
  dayKey: string,
): Promise<boolean> {
  const row = await prisma.alertDispatch.findUnique({
    where: { userId_type_dayKey: { userId, type, dayKey } },
    select: { id: true },
  });
  return row !== null;
}

export async function recordAlertDispatches(
  items: Array<{ userId: string; type: IntegrationAlertType; dayKey: string }>,
): Promise<void> {
  for (const item of items) {
    await prisma.alertDispatch.upsert({
      where: {
        userId_type_dayKey: {
          userId: item.userId,
          type: item.type,
          dayKey: item.dayKey,
        },
      },
      create: {
        userId: item.userId,
        type: item.type,
        dayKey: item.dayKey,
      },
      update: {},
    });
  }
}

export async function filterUndispatchedAlertTypes(
  userId: string,
  dayKey: string,
  types: IntegrationAlertType[],
): Promise<IntegrationAlertType[]> {
  const pending: IntegrationAlertType[] = [];
  for (const type of types) {
    if (!(await wasAlertDispatchedToday(userId, type, dayKey))) {
      pending.push(type);
    }
  }
  return pending;
}
