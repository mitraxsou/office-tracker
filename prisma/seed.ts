import { PrismaClient } from "@prisma/client";
import { DEFAULT_HOURS_TARGET, DEFAULT_OFFICE_SSIDS } from "../src/lib/constants";
import { ensureBreakglassAdmin } from "../src/lib/breakglass";

const prisma = new PrismaClient();

async function main() {
  await prisma.appConfig.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      hoursTarget: DEFAULT_HOURS_TARGET,
      officeSsids: JSON.stringify(DEFAULT_OFFICE_SSIDS),
      maxDevicesPerUser: 10,
    },
    update: {},
  });

  const breakglass = await ensureBreakglassAdmin();
  if (breakglass) {
    console.log(`Breakglass admin ensured: ${breakglass.email}`);
  } else {
    console.log("Breakglass admin skipped (set BREAKGLASS_EMAIL + BREAKGLASS_PASSWORD)");
  }

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  if (adminEmail) {
    await prisma.user.updateMany({
      where: { email: adminEmail },
      data: { role: "admin" },
    });
    console.log(`Set admin role for ${adminEmail}`);
  }

  console.log("Seed complete");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
