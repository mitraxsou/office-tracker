import { prisma } from "./db";
import { DEFAULT_HOURS_TARGET, DEFAULT_MONTHLY_DAYS_TARGET, parseDefaultSsidsFromEnv } from "./constants";
import { ensureBreakglassAdmin } from "./breakglass";

export async function seedDefaults() {
  await prisma.appConfig.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      hoursTarget: DEFAULT_HOURS_TARGET,
      monthlyDaysTarget: DEFAULT_MONTHLY_DAYS_TARGET,
      officeSsids: JSON.stringify(parseDefaultSsidsFromEnv()),
      maxDevicesPerUser: 10,
      allowRegistration: false,
      allowOtpSelfRegistration: true,
    },
    // Seed runs on every deploy when RUN_DB_SETUP_ON_DEPLOY=true. Leave an existing row
    // alone so it cannot overwrite SSIDs and targets an admin set in /admin/settings.
    update: {},
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
