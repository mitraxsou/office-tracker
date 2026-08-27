import { prisma } from "./db";
import { DEFAULT_HOURS_TARGET, DEFAULT_OFFICE_SSIDS } from "./constants";

export type AppConfigData = {
  hoursTarget: number;
  officeSsids: string[];
  maxDevicesPerUser: number;
  allowRegistration: boolean;
};

const CONFIG_ID = "global";

export async function ensureAppConfig(): Promise<AppConfigData> {
  let config = await prisma.appConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!config) {
    config = await prisma.appConfig.create({
      data: {
        id: CONFIG_ID,
        hoursTarget: DEFAULT_HOURS_TARGET,
        officeSsids: JSON.stringify(DEFAULT_OFFICE_SSIDS),
        maxDevicesPerUser: 10,
        allowRegistration: false,
      },
    });
  }
  return parseConfig(config);
}

export async function getAppConfig(): Promise<AppConfigData> {
  return ensureAppConfig();
}

export async function updateAppConfig(data: Partial<AppConfigData>) {
  await ensureAppConfig();
  const update: Record<string, unknown> = {};
  if (data.hoursTarget !== undefined) update.hoursTarget = data.hoursTarget;
  if (data.officeSsids !== undefined) update.officeSsids = JSON.stringify(data.officeSsids);
  if (data.maxDevicesPerUser !== undefined) update.maxDevicesPerUser = data.maxDevicesPerUser;
  if (data.allowRegistration !== undefined) update.allowRegistration = data.allowRegistration;

  const config = await prisma.appConfig.update({
    where: { id: CONFIG_ID },
    data: update,
  });
  return parseConfig(config);
}

export async function getUserHoursTarget(user: { hoursTarget: number | null }) {
  const global = await getAppConfig();
  return user.hoursTarget ?? global.hoursTarget;
}

function parseConfig(config: {
  hoursTarget: number;
  officeSsids: string;
  maxDevicesPerUser: number;
  allowRegistration: boolean;
}): AppConfigData {
  let ssids: string[] = DEFAULT_OFFICE_SSIDS;
  try {
    const parsed = JSON.parse(config.officeSsids);
    if (Array.isArray(parsed)) ssids = parsed;
  } catch {
    /* use default */
  }
  return {
    hoursTarget: config.hoursTarget,
    officeSsids: ssids,
    maxDevicesPerUser: config.maxDevicesPerUser,
    allowRegistration: config.allowRegistration,
  };
}
