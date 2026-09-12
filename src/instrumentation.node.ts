export async function registerNode() {
  const { hasPostgresEnv } = await import("./lib/db-env");
  if (!hasPostgresEnv()) return;

  const { prisma } = await import("./lib/db");
  const { ensureBreakglassAdmin } = await import("./lib/breakglass");
  const { ensureAppConfig, logAppConfigSchemaDriftIfNeeded, logDatabaseAccessDeniedIfNeeded } =
    await import("./lib/app-config");
  const skipSchemaMigrations = process.env.SCHEMA_AUTO_MIGRATE?.trim().toLowerCase() === "false";
  try {
    if (!skipSchemaMigrations) {
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
      'ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "heartbeatIntervalMinutes" INTEGER NOT NULL DEFAULT 5;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "agentStaleMinutes" INTEGER NOT NULL DEFAULT 15;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AppConfig" ALTER COLUMN "agentStaleMinutes" SET DEFAULT 15;'
    );
    await prisma.$executeRawUnsafe(
      'UPDATE "AppConfig" SET "agentStaleMinutes" = 15 WHERE "agentStaleMinutes" = 8;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "agentStaleGraceHours" INTEGER NOT NULL DEFAULT 24;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agentStaleGraceHours" INTEGER;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agentDeregisteredAt" TIMESTAMP(3);'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "monthlyDaysTarget" INTEGER NOT NULL DEFAULT 8;'
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UserNotificationPrefs" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "workDays" TEXT NOT NULL DEFAULT '[3,5]',
        "officeStartTime" TEXT NOT NULL DEFAULT '09:30',
        "officeEndTime" TEXT NOT NULL DEFAULT '18:00',
        "graceMinutes" INTEGER NOT NULL DEFAULT 45,
        "notifyTeams" BOOLEAN NOT NULL DEFAULT true,
        "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
        "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
        "alertIfNotInOffice" BOOLEAN NOT NULL DEFAULT true,
        "alertIfAgentStale" BOOLEAN NOT NULL DEFAULT true,
        "alertIfBehindHours" BOOLEAN NOT NULL DEFAULT false,
        "alertIfHoursStarted" BOOLEAN NOT NULL DEFAULT true,
        "alertIfHoursMet" BOOLEAN NOT NULL DEFAULT true,
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
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "UserNotificationPrefs" ADD COLUMN IF NOT EXISTS "alertIfHoursStarted" BOOLEAN NOT NULL DEFAULT true;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "UserNotificationPrefs" ADD COLUMN IF NOT EXISTS "alertIfHoursMet" BOOLEAN NOT NULL DEFAULT true;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "UserNotificationPrefs" ADD COLUMN IF NOT EXISTS "channelNotInOffice" TEXT NOT NULL DEFAULT \'app\';'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "UserNotificationPrefs" ADD COLUMN IF NOT EXISTS "channelAgentStale" TEXT NOT NULL DEFAULT \'app\';'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "UserNotificationPrefs" ADD COLUMN IF NOT EXISTS "channelBehindHours" TEXT NOT NULL DEFAULT \'app\';'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "UserNotificationPrefs" ADD COLUMN IF NOT EXISTS "channelHoursStarted" TEXT NOT NULL DEFAULT \'teams\';'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "UserNotificationPrefs" ADD COLUMN IF NOT EXISTS "channelHoursMet" TEXT NOT NULL DEFAULT \'teams\';'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "UserNotificationPrefs" ALTER COLUMN "notifyEmail" SET DEFAULT false;'
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "UserNotificationPrefs" SET "notifyEmail" = false WHERE "notifyEmail" = true;`
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "InAppNotification" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "dayKey" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "readAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "InAppNotification_userId_type_dayKey_key" ON "InAppNotification"("userId", "type", "dayKey");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "InAppNotification_userId_readAt_idx" ON "InAppNotification"("userId", "readAt");'
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "UserNotificationPrefs"
       SET "workDays" = '[3,5]'
       WHERE "workDays" = '[1,2,3,4,5]'
         AND "scheduleUserSet" = false
         AND "scheduleAutoFilled" = false;`
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
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "IntegrationApiKey" ADD COLUMN IF NOT EXISTS "encryptedSecret" TEXT;'
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
      CREATE TABLE IF NOT EXISTS "ManualVisitRequest" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "startAt" TIMESTAMP(3) NOT NULL,
        "endAt" TIMESTAMP(3),
        "ssid" TEXT NOT NULL DEFAULT 'manual',
        "message" TEXT,
        "status" TEXT NOT NULL DEFAULT 'open',
        "adminNote" TEXT,
        "reviewedAt" TIMESTAMP(3),
        "reviewedById" TEXT,
        "visitId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ManualVisitRequest_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "ManualVisitRequest_status_createdAt_idx" ON "ManualVisitRequest"("status", "createdAt");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "ManualVisitRequest_userId_idx" ON "ManualVisitRequest"("userId");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "ManualVisitRequest_userId_startAt_idx" ON "ManualVisitRequest"("userId", "startAt");'
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
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AgentDevice" ADD COLUMN IF NOT EXISTS "agentApiUrl" TEXT;'
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
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AdminContactSubmission" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'open',
        "adminResponse" TEXT,
        "reviewedAt" TIMESTAMP(3),
        "reviewedById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AdminContactSubmission_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "AdminContactSubmission_status_createdAt_idx" ON "AdminContactSubmission"("status", "createdAt");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "AdminContactSubmission_userId_idx" ON "AdminContactSubmission"("userId");'
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AdminContactMessage" (
        "id" TEXT NOT NULL,
        "threadId" TEXT NOT NULL,
        "authorId" TEXT NOT NULL,
        "authorRole" TEXT NOT NULL,
        "body" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AdminContactMessage_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "AdminContactMessage_threadId_createdAt_idx" ON "AdminContactMessage"("threadId", "createdAt");'
    );
    const { migrateAdminContactThreads } = await import("./lib/admin-contact");
    await migrateAdminContactThreads().catch(() => undefined);
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "priorComplianceOnboardingAt" TIMESTAMP(3);'
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PriorComplianceDeclaration" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "monthKey" TEXT NOT NULL,
        "typicalCheckInTime" TEXT NOT NULL,
        "qualifyingDaysCount" INTEGER NOT NULL,
        "message" TEXT,
        "status" TEXT NOT NULL DEFAULT 'open',
        "source" TEXT NOT NULL DEFAULT 'onboarding',
        "adminNote" TEXT,
        "reviewedAt" TIMESTAMP(3),
        "reviewedById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PriorComplianceDeclaration_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "PriorComplianceDeclaration_status_createdAt_idx" ON "PriorComplianceDeclaration"("status", "createdAt");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "PriorComplianceDeclaration_userId_idx" ON "PriorComplianceDeclaration"("userId");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "PriorComplianceDeclaration_userId_monthKey_idx" ON "PriorComplianceDeclaration"("userId", "monthKey");'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "allowOtpSelfRegistration" BOOLEAN NOT NULL DEFAULT true;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 4;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "fiscalYearEndMonth" INTEGER NOT NULL DEFAULT 3;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChosenAt" TIMESTAMP(3);'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "registrationSource" TEXT NOT NULL DEFAULT \'admin\';'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedVersion" INTEGER;'
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "termsAcceptedVersion" = 1 WHERE "termsAcceptedAt" IS NOT NULL AND "termsAcceptedVersion" IS NULL;`
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LegalConfig" (
        "id" TEXT NOT NULL,
        "legalVersion" INTEGER NOT NULL DEFAULT 1,
        "termsContent" TEXT NOT NULL DEFAULT '[]',
        "privacyContent" TEXT NOT NULL DEFAULT '[]',
        "draftTermsContent" TEXT,
        "draftPrivacyContent" TEXT,
        "draftChangeSummary" TEXT,
        "changeSummary" TEXT,
        "publishedAt" TIMESTAMP(3),
        "publishedById" TEXT,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "LegalConfig_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LoginOtp" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "codeHash" TEXT NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "LoginOtp_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "LoginOtp_email_createdAt_idx" ON "LoginOtp"("email", "createdAt");'
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AuthRateLimitEvent" (
        "id" TEXT NOT NULL,
        "bucket" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AuthRateLimitEvent_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "AuthRateLimitEvent_bucket_key_createdAt_idx" ON "AuthRateLimitEvent"("bucket", "key", "createdAt");'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "UserNotificationPrefs" ALTER COLUMN "alertIfNotInOffice" SET DEFAULT false;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "UserNotificationPrefs" ALTER COLUMN "alertIfAgentStale" SET DEFAULT false;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AppConfig" ADD COLUMN IF NOT EXISTS "agentMode" TEXT NOT NULL DEFAULT \'events\';'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "localVisitId" TEXT;'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "Visit_userId_localVisitId_idx" ON "Visit"("userId", "localVisitId");'
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DailySummary" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "dayKey" TEXT NOT NULL,
        "officeMs" INTEGER NOT NULL,
        "laptopActiveMs" INTEGER NOT NULL DEFAULT 0,
        "visitCount" INTEGER NOT NULL DEFAULT 0,
        "firstCheckInAt" TIMESTAMP(3),
        "lastCheckOutAt" TIMESTAMP(3),
        "source" TEXT NOT NULL DEFAULT 'agent',
        "verified" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DailySummary_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "DailySummary_userId_dayKey_key" ON "DailySummary"("userId", "dayKey");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "DailySummary_dayKey_idx" ON "DailySummary"("dayKey");'
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PresenceTransition" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "deviceId" TEXT,
        "type" TEXT NOT NULL,
        "at" TIMESTAMP(3) NOT NULL,
        "dayKey" TEXT NOT NULL,
        "ssid" TEXT,
        "previousSsid" TEXT,
        "inOffice" BOOLEAN NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PresenceTransition_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "PresenceTransition_userId_at_idx" ON "PresenceTransition"("userId", "at");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "PresenceTransition_userId_dayKey_idx" ON "PresenceTransition"("userId", "dayKey");'
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ActivityTick" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "deviceId" TEXT,
        "at" TIMESTAMP(3) NOT NULL,
        "ssid" TEXT,
        "inOffice" BOOLEAN NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ActivityTick_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "ActivityTick_userId_at_idx" ON "ActivityTick"("userId", "at");'
    );
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AgentEvent" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "deviceId" TEXT,
        "clientEventId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "payload" JSONB NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'accepted',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AgentEvent_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "AgentEvent_userId_clientEventId_key" ON "AgentEvent"("userId", "clientEventId");'
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "AgentEvent_userId_createdAt_idx" ON "AgentEvent"("userId", "createdAt");'
    );
    }
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AlertDispatch" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "dayKey" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AlertDispatch_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "AlertDispatch_userId_type_dayKey_key" ON "AlertDispatch"("userId", "type", "dayKey");',
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "AlertDispatch_userId_dayKey_idx" ON "AlertDispatch"("userId", "dayKey");',
    );
    await ensureAppConfig();
    const { ensureLegalConfig } = await import("./lib/legal-config");
    await ensureLegalConfig();
    await ensureBreakglassAdmin();
  } catch (err) {
    if (!logAppConfigSchemaDriftIfNeeded(err) && !logDatabaseAccessDeniedIfNeeded(err)) {
      console.error("[startup] breakglass/config init failed:", err);
    }
  }
}
