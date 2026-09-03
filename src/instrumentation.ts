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
      'ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "heartbeatRetentionDays" INTEGER NOT NULL DEFAULT 7;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "agentStaleMinutes" INTEGER NOT NULL DEFAULT 8;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "agentStaleGraceHours" INTEGER NOT NULL DEFAULT 24;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agentStaleGraceHours" INTEGER;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "monthlyDaysTarget" INTEGER NOT NULL DEFAULT 8;'
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
        "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
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
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "UserNotificationPrefs" ADD COLUMN IF NOT EXISTS "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "UserNotificationPrefs" ADD COLUMN IF NOT EXISTS "scheduleAutoFilled" BOOLEAN NOT NULL DEFAULT false;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "UserNotificationPrefs" ADD COLUMN IF NOT EXISTS "scheduleUserSet" BOOLEAN NOT NULL DEFAULT false;'
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "VisitCorrectionRequest" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "visitId" TEXT,
        "message" TEXT NOT NULL,
        "issueType" TEXT,
        "status" TEXT NOT NULL DEFAULT 'open',
        "adminNote" TEXT,
        "resolvedAt" TIMESTAMP(3),
        "resolvedById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "VisitCorrectionRequest_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "VisitCorrectionRequest_status_createdAt_idx" ON "VisitCorrectionRequest"("status", "createdAt");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "VisitCorrectionRequest_userId_idx" ON "VisitCorrectionRequest"("userId");'
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "IntegrationApiKey" (
        "id" TEXT NOT NULL,
        "label" TEXT NOT NULL,
        "keyPrefix" TEXT NOT NULL,
        "keyHash" TEXT NOT NULL,
        "createdById" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "revokedAt" TIMESTAMP(3),
        "lastUsedAt" TIMESTAMP(3),
        CONSTRAINT "IntegrationApiKey_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationApiKey_keyPrefix_key" ON "IntegrationApiKey"("keyPrefix");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "IntegrationApiKey_createdById_idx" ON "IntegrationApiKey"("createdById");'
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UserOutOfOffice" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "startDate" TEXT NOT NULL,
        "endDate" TEXT NOT NULL,
        "source" TEXT NOT NULL DEFAULT 'settings',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UserOutOfOffice_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "UserOutOfOffice" ADD COLUMN IF NOT EXISTS "startDate" TEXT;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "UserOutOfOffice" ADD COLUMN IF NOT EXISTS "endDate" TEXT;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "UserOutOfOffice" ADD COLUMN IF NOT EXISTS "dayKey" TEXT;'
    );
    await prisma.$executeRawUnsafe(
      'UPDATE "UserOutOfOffice" SET "startDate" = "dayKey", "endDate" = "dayKey" WHERE "startDate" IS NULL AND "dayKey" IS NOT NULL;'
    );
    await prisma.$executeRawUnsafe(
      'DROP INDEX IF EXISTS "UserOutOfOffice_userId_dayKey_key";'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "UserOutOfOffice_userId_idx" ON "UserOutOfOffice"("userId");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "UserOutOfOffice_userId_startDate_idx" ON "UserOutOfOffice"("userId", "startDate");'
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DeviceRemovalRequest" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "deviceId" TEXT NOT NULL,
        "message" TEXT,
        "status" TEXT NOT NULL DEFAULT 'open',
        "adminNote" TEXT,
        "resolvedAt" TIMESTAMP(3),
        "resolvedById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DeviceRemovalRequest_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "DeviceRemovalRequest_status_createdAt_idx" ON "DeviceRemovalRequest"("status", "createdAt");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "DeviceRemovalRequest_userId_idx" ON "DeviceRemovalRequest"("userId");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "DeviceRemovalRequest_deviceId_idx" ON "DeviceRemovalRequest"("deviceId");'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "VisitCorrectionRequest" ADD COLUMN IF NOT EXISTS "visitSnapshot" TEXT;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "VisitCorrectionRequest" ADD COLUMN IF NOT EXISTS "correctionSummary" TEXT;'
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "VisitCorrectionMessage" (
        "id" TEXT NOT NULL,
        "requestId" TEXT NOT NULL,
        "authorId" TEXT NOT NULL,
        "authorRole" TEXT NOT NULL,
        "body" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "VisitCorrectionMessage_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "VisitCorrectionMessage_requestId_createdAt_idx" ON "VisitCorrectionMessage"("requestId", "createdAt");'
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TimezoneChangeRequest" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "requestedTimezone" TEXT NOT NULL,
        "currentTimezone" TEXT NOT NULL,
        "message" TEXT,
        "status" TEXT NOT NULL DEFAULT 'open',
        "adminNote" TEXT,
        "reviewedAt" TIMESTAMP(3),
        "reviewedById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TimezoneChangeRequest_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "TimezoneChangeRequest_status_createdAt_idx" ON "TimezoneChangeRequest"("status", "createdAt");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "TimezoneChangeRequest_userId_idx" ON "TimezoneChangeRequest"("userId");'
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ProfileChangeRequest" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "currentName" TEXT,
        "currentEmail" TEXT NOT NULL,
        "requestedName" TEXT,
        "requestedEmail" TEXT,
        "message" TEXT,
        "status" TEXT NOT NULL DEFAULT 'open',
        "adminNote" TEXT,
        "reviewedAt" TIMESTAMP(3),
        "reviewedById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ProfileChangeRequest_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "ProfileChangeRequest_status_createdAt_idx" ON "ProfileChangeRequest"("status", "createdAt");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "ProfileChangeRequest_userId_idx" ON "ProfileChangeRequest"("userId");'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AgentDevice" ADD COLUMN IF NOT EXISTS "installedAt" TIMESTAMP(3);'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AgentDevice" ADD COLUMN IF NOT EXISTS "uninstalledAt" TIMESTAMP(3);'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AgentDevice" ADD COLUMN IF NOT EXISTS "agentScriptVersion" TEXT;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AgentDevice" ADD COLUMN IF NOT EXISTS "agentVersionReportedAt" TIMESTAMP(3);'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AgentDevice" ADD COLUMN IF NOT EXISTS "forceAgentUpdate" BOOLEAN NOT NULL DEFAULT false;'
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AgentLifecycleEvent" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "deviceId" TEXT,
        "serialNumber" TEXT NOT NULL,
        "eventType" TEXT NOT NULL,
        "source" TEXT NOT NULL,
        "metadata" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AgentLifecycleEvent_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "AgentLifecycleEvent_userId_createdAt_idx" ON "AgentLifecycleEvent"("userId", "createdAt");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "AgentLifecycleEvent_deviceId_createdAt_idx" ON "AgentLifecycleEvent"("deviceId", "createdAt");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "AgentLifecycleEvent_serialNumber_createdAt_idx" ON "AgentLifecycleEvent"("serialNumber", "createdAt");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "AgentLifecycleEvent_eventType_createdAt_idx" ON "AgentLifecycleEvent"("eventType", "createdAt");'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "complianceExemptionRequiresApproval" BOOLEAN NOT NULL DEFAULT true;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "pilotStartMonthKey" TEXT NOT NULL DEFAULT \'2026-09\';'
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ComplianceExemptionRequest" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "monthKey" TEXT,
        "dayKey" TEXT,
        "message" TEXT,
        "status" TEXT NOT NULL DEFAULT 'open',
        "adminNote" TEXT,
        "reviewedAt" TIMESTAMP(3),
        "reviewedById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ComplianceExemptionRequest_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "ComplianceExemptionRequest_status_createdAt_idx" ON "ComplianceExemptionRequest"("status", "createdAt");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "ComplianceExemptionRequest_userId_idx" ON "ComplianceExemptionRequest"("userId");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "ComplianceExemptionRequest_userId_monthKey_idx" ON "ComplianceExemptionRequest"("userId", "monthKey");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "ComplianceExemptionRequest_userId_dayKey_idx" ON "ComplianceExemptionRequest"("userId", "dayKey");'
    );
    await ensureAppConfig();
    await ensureBreakglassAdmin();
  } catch (err) {
    if (!logAppConfigSchemaDriftIfNeeded(err)) {
      console.error("[startup] breakglass/config init failed:", err);
    }
  }
}
