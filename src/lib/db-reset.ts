import { prisma } from "./db";
import { seedDefaults } from "./db-seed";

export async function resetPilotDatabase() {
  await prisma.$executeRaw`
    TRUNCATE TABLE "AuditLog", "Heartbeat", "Visit", "AgentDevice", "AgentToken", "User", "AppConfig" CASCADE
  `;
  await seedDefaults();
}
