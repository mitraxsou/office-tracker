import { PrismaClient } from "@prisma/client";
import { seedDefaults } from "../src/lib/db-seed";

const prisma = new PrismaClient();

async function main() {
  await seedDefaults();
  console.log("Seed complete");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
