import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const at = await prisma.agentToken.findFirst({
    include: { user: { include: { agentDevices: true } } },
  });
  if (!at) {
    console.log("NO_TOKEN");
    return;
  }
  console.log(`EMAIL:${at.user.email}`);
  console.log(`PREFIX:${at.tokenPrefix}`);
  console.log(
    `DEVICES:${at.user.agentDevices.map((d) => d.serialNumber).join(",") || "none"}`
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
