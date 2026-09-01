export async function register() {
  // DB seeding runs at server startup only — not during `next build`
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { hasPostgresEnv } = await import("./lib/db-env");
  if (!hasPostgresEnv()) return;

  const { prisma } = await import("./lib/db");
  const { ensureBreakglassAdmin } = await import("./lib/breakglass");
  const { ensureAppConfig, logAppConfigSchemaDriftIfNeeded } = await import("./lib/app-config");
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "allowRegistration" BOOLEAN NOT NULL DEFAULT false;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AgentToken" DROP CONSTRAINT IF EXISTS "AgentToken_userId_key";'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AgentToken" ADD COLUMN IF NOT EXISTS "label" TEXT;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AgentToken" ADD COLUMN IF NOT EXISTS "boundSerialNumber" TEXT;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AgentToken" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AgentToken" ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3);'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AgentToken" ADD COLUMN IF NOT EXISTS "issuedById" TEXT;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AgentToken" ADD COLUMN IF NOT EXISTS "pendingTokenEnc" TEXT;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AgentDevice" ADD COLUMN IF NOT EXISTS "agentTokenId" TEXT;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AgentToken" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "pendingTokenTtlDays" INTEGER NOT NULL DEFAULT 7;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "heartbeatRetentionDays" INTEGER NOT NULL DEFAULT 1;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "agentStaleMinutes" INTEGER NOT NULL DEFAULT 8;'
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UserNotificationPrefs" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "workDays" TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
        "officeStartTime" TEXT NOT NULL DEFAULT '09:30',
        "officeEndTime" TEXT NOT NULL DEFAULT '18:00',
        "graceMinutes" INTEGER NOT NULL DEFAULT 45,
        "notifyTeams" BOOLEAN NOT NULL DEFAULT true,
        "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
        "alertIfNotInOffice" BOOLEAN NOT NULL DEFAULT true,
        "alertIfAgentStale" BOOLEAN NOT NULL DEFAULT true,
        "alertIfBehindHours" BOOLEAN NOT NULL DEFAULT false,
        "behindHoursCheckTime" TEXT NOT NULL DEFAULT '15:00',
        "behindHoursMinExpected" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UserNotificationPrefs_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UserNotificationPrefs_userId_key" ON "UserNotificationPrefs"("userId");'
    );
    await ensureAppConfig();
    await ensureBreakglassAdmin();
  } catch (err) {
    if (!logAppConfigSchemaDriftIfNeeded(err)) {
      console.error("[startup] breakglass/config init failed:", err);
    }
  }
}
