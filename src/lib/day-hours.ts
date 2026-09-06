import { loadDaySpanContext } from "./heartbeat-service";
import { daySpanMsForDay } from "./visits";
import { laptopActiveHoursForDay } from "./laptop-active";

export async function aggregateHoursForDay(userId: string, timezone: string, dayKey: string) {
  const { visits, params } = await loadDaySpanContext(userId, dayKey, timezone);
  return daySpanMsForDay(visits, params) / (1000 * 60 * 60);
}

export async function aggregateLaptopActiveForDay(
  userId: string,
  timezone: string,
  dayKey: string,
) {
  const { laptopActiveParams } = await loadDaySpanContext(userId, dayKey, timezone);
  return laptopActiveHoursForDay(laptopActiveParams);
}
