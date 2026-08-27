import { prisma } from "./db";
import { DEFAULT_HOURS_TARGET, DEFAULT_OFFICE_SSIDS } from "./constants";
import { ensureBreakglassAdmin } from "./breakglass";

export async function seedDefaults() {
  await prisma.appConfig.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      hoursTarget: DEFAULT_HOURS_TARGET,
      officeSsids: JSON.stringify(DEFAULT_OFFICE_SSIDS),
      maxDevicesPerUser: 10,
      allowRegistration: false,
    },
    update: {
      hoursTarget: DEFAULT_HOURS_TARGET,
      officeSsids: JSON.stringify(DEFAULT_OFFICE_SSIDS),
      maxDevicesPerUser: 10,
      allowRegistration: false,
    },
  });

  const breakglass = await ensureBreakglassAdmin();
  if (breakglass) {
    console.log(`Breakglass admin ensured: ${breakglass.email}`);
  }

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  if (adminEmail) {
    await prisma.user.updateMany({
      where: { email: adminEmail },
      data: { role: "admin" },
    });
    console.log(`Set admin role for ${adminEmail}`);
  }
}
