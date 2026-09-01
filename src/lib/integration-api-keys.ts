import crypto from "crypto";
import { prisma } from "./db";
import { hashPassword, verifyPassword } from "./auth";

export function generateIntegrationApiKey() {
  return crypto.randomBytes(32).toString("hex");
}

export function extractIntegrationApiKey(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  const header = request.headers.get("x-api-key")?.trim();
  return header || null;
}

function matchesEnvIntegrationKey(key: string): boolean {
  const expected = process.env.INTEGRATION_API_KEY?.trim();
  return Boolean(expected && key === expected);
}

export async function verifyIntegrationApiKey(request: Request): Promise<boolean> {
  const key = extractIntegrationApiKey(request);
  if (!key || key.length < 16) return false;

  if (matchesEnvIntegrationKey(key)) return true;

  const keyPrefix = key.slice(0, 8);
  const record = await prisma.integrationApiKey.findUnique({
    where: { keyPrefix },
  });

  if (!record || record.revokedAt) return false;

  const valid = await verifyPassword(key, record.keyHash);
  if (!valid) return false;

  await prisma.integrationApiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });

  return true;
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

  const record = await prisma.integrationApiKey.create({
    data: {
      label: trimmedLabel,
      keyHash,
      keyPrefix,
      createdById,
    },
  });

  return { record, plainKey };
}

export async function revokeIntegrationApiKey(id: string) {
  const record = await prisma.integrationApiKey.findUnique({ where: { id } });
  if (!record || record.revokedAt) return null;

  return prisma.integrationApiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

/** Exported for unit tests */
export async function verifyIntegrationApiKeyValue(
  key: string,
  lookup: (prefix: string) => Promise<{
    id: string;
    keyHash: string;
    revokedAt: Date | null;
  } | null>,
): Promise<boolean> {
  if (!key || key.length < 16) return false;
  if (matchesEnvIntegrationKey(key)) return true;

  const record = await lookup(key.slice(0, 8));
  if (!record || record.revokedAt) return false;

  return verifyPassword(key, record.keyHash);
}
