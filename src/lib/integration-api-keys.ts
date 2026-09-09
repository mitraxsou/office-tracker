import crypto from "node:crypto";
import { prisma } from "./db";
import { hashPassword } from "./auth";

export const ENV_WEBHOOK_SECRET_ID = "env";

export function generateIntegrationApiKey() {
  return crypto.randomBytes(32).toString("hex");
}

/** Server env secret for X-Office-Pulse-Token (survives AUTH_SECRET rotation). */
export function getPowerAutomateWebhookSecretFromEnv(): string | null {
  const secret = process.env.POWER_AUTOMATE_WEBHOOK_SECRET?.trim();
  return secret || null;
}

/** True when webhook auth is managed via POWER_AUTOMATE_WEBHOOK_SECRET (required on Vercel). */
export function isWebhookSecretEnvManaged(): boolean {
  return getPowerAutomateWebhookSecretFromEnv() !== null;
}

function encryptionKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptIntegrationSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptIntegrationSecret(encrypted: string): string | null {
  try {
    const buffer = Buffer.from(encrypted, "base64url");
    if (buffer.length < 29) return null;
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const data = buffer.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export async function listIntegrationApiKeys() {
  const keys = await prisma.integrationApiKey.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { email: true, name: true } },
    },
  });

  return keys.map((key) => ({
    id: key.id,
    label: key.label,
    keyPrefix: key.keyPrefix,
    createdAt: key.createdAt.toISOString(),
    revokedAt: key.revokedAt?.toISOString() ?? null,
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    createdByEmail: key.createdBy.email,
    createdByName: key.createdBy.name,
  }));
}

export async function createIntegrationApiKey(label: string, createdById: string) {
  const trimmedLabel = label.trim();
  if (!trimmedLabel) {
    throw new Error("Label is required");
  }

  const plainKey = generateIntegrationApiKey();
  const keyHash = await hashPassword(plainKey);
  const keyPrefix = plainKey.slice(0, 8);
  const encryptedSecret = encryptIntegrationSecret(plainKey);

  const record = await prisma.$transaction(async (tx) => {
    await tx.integrationApiKey.updateMany({
      where: { revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return tx.integrationApiKey.create({
      data: {
        label: trimmedLabel,
        keyHash,
        keyPrefix,
        encryptedSecret,
        createdById,
      },
    });
  });

  return { record, plainKey };
}

export async function getActiveIntegrationSecret(): Promise<{
  id: string;
  actorId: string;
  secret: string;
} | null> {
  const envSecret = getPowerAutomateWebhookSecretFromEnv();
  if (!envSecret) return null;
  return { id: ENV_WEBHOOK_SECRET_ID, actorId: ENV_WEBHOOK_SECRET_ID, secret: envSecret };
}

export async function markIntegrationSecretUsed(id: string) {
  await prisma.integrationApiKey.update({
    where: { id },
    data: { lastUsedAt: new Date() },
  });
}

export async function revokeIntegrationApiKey(id: string) {
  const record = await prisma.integrationApiKey.findUnique({ where: { id } });
  if (!record || record.revokedAt) return null;

  return prisma.integrationApiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}
