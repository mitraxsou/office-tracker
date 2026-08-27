import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getAppConfig } from "../src/lib/app-config";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: { agentToken: true, agentDevices: true },
  });

  if (users.length === 0) {
    console.log("NO_USERS");
    return;
  }

  const config = await getAppConfig();

  for (const user of users) {
    console.log(`USER:${user.email}`);
    console.log(`ROLE:${user.role}`);
    console.log(`SSIDS:${config.officeSsids.join(",")}`);
    console.log(
      `DEVICES:${user.agentDevices.map((d) => d.serialNumber).join(",") || "none"}`
    );
  }

  const user = users[0];
  const plainToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = await bcrypt.hash(plainToken, 12);
  const tokenPrefix = plainToken.slice(0, 8);

  await prisma.agentToken.upsert({
    where: { userId: user.id },
    create: { userId: user.id, tokenHash, tokenPrefix },
    update: { tokenHash, tokenPrefix },
  });

  console.log(`TOKEN:${plainToken}`);
  console.log(`USERID:${user.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
