/**
 * Recover POWER_AUTOMATE_WEBHOOK_SECRET from IntegrationApiKey (Hobby AUTH_SECRET)
 * and sync to Enterprise Vercel projects. Does not print the secret.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[trimmed.slice(0, eq).trim()] = value;
  }
  return env;
}

function decryptIntegrationSecret(encrypted, authSecret) {
  const key = crypto.createHash("sha256").update(authSecret).digest();
  const buffer = Buffer.from(encrypted, "base64url");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const data = buffer.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

async function setVercelEnv(projectName, teamId, key, value, token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const listUrl = `https://api.vercel.com/v9/projects/${encodeURIComponent(projectName)}/env?teamId=${encodeURIComponent(teamId)}`;
  const listRes = await fetch(listUrl, { headers });
  if (!listRes.ok) throw new Error(`List env failed for ${projectName}: ${listRes.status}`);
  const list = await listRes.json();
  const existing = list.envs?.find((row) => row.key === key);
  const body = JSON.stringify({
    key,
    value,
    type: "encrypted",
    target: ["production", "preview", "development"],
  });
  if (existing) {
    const patchUrl = `https://api.vercel.com/v9/projects/${encodeURIComponent(projectName)}/env/${existing.id}?teamId=${encodeURIComponent(teamId)}`;
    const res = await fetch(patchUrl, { method: "PATCH", headers, body });
    if (!res.ok) throw new Error(`Patch ${key} on ${projectName}: ${res.status}`);
    return "updated";
  }
  const postUrl = `https://api.vercel.com/v10/projects/${encodeURIComponent(projectName)}/env?teamId=${encodeURIComponent(teamId)}`;
  const res = await fetch(postUrl, { method: "POST", headers, body });
  if (!res.ok) throw new Error(`Create ${key} on ${projectName}: ${res.status}`);
  return "created";
}

const envSources = [
  ".env.vercel.prod.local",
  ".env.vercel.local",
  ".env.vercel.dev.local",
  ".env",
  ".env.local",
];
const mergedEnv = {};
for (const file of envSources) {
  Object.assign(mergedEnv, loadEnvFile(join(repoRoot, file)));
}
const authSecret = mergedEnv.AUTH_SECRET;
const postgresUrl = mergedEnv.POSTGRES_PRISMA_URL;
if (!authSecret || !postgresUrl) {
  console.error("Missing AUTH_SECRET or POSTGRES_PRISMA_URL in local .env files");
  process.exit(1);
}
if (!process.env.VERCEL_TOKEN) {
  console.error("VERCEL_TOKEN required");
  process.exit(1);
}

process.env.POSTGRES_PRISMA_URL = postgresUrl;
const prisma = new PrismaClient();
const keys = await prisma.integrationApiKey.findMany({
  where: { revokedAt: null, encryptedSecret: { not: null } },
  orderBy: { createdAt: "desc" },
});

let secret = null;
for (const row of keys) {
  try {
    secret = decryptIntegrationSecret(row.encryptedSecret, authSecret);
    console.log(`Recovered secret from IntegrationApiKey prefix ${row.keyPrefix}`);
    break;
  } catch {
    // try next key with different AUTH_SECRET rotation
  }
}
await prisma.$disconnect();

if (!secret) {
  console.error("Could not decrypt any active IntegrationApiKey. Copy POWER_AUTOMATE_WEBHOOK_SECRET from Hobby Vercel manually.");
  process.exit(1);
}

const teamId = "team_aibOHBi06MpPxWdFWRGDp9iK";
const projects = ["office-tracker-prod", "office-tracker-dev-9824"];
for (const project of projects) {
  const action = await setVercelEnv(
    project,
    teamId,
    "POWER_AUTOMATE_WEBHOOK_SECRET",
    secret,
    process.env.VERCEL_TOKEN,
  );
  console.log(`${project}: ${action} POWER_AUTOMATE_WEBHOOK_SECRET`);
}

const webhookUrl = mergedEnv.POWER_AUTOMATE_WEBHOOK_URL;
if (webhookUrl) {
  for (const project of projects) {
    const action = await setVercelEnv(
      project,
      teamId,
      "POWER_AUTOMATE_WEBHOOK_URL",
      webhookUrl,
      process.env.VERCEL_TOKEN,
    );
    console.log(`${project}: ${action} POWER_AUTOMATE_WEBHOOK_URL`);
  }
}

console.log("Done. Redeploy Enterprise prod and dev for OTP login.");
