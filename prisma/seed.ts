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

  await ensureBreakglassAdmin();
  console.log("Breakglass admin ensured: admin@pwc.office");

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
