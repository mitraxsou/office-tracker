/**
 * Resolves Postgres connection env vars for Prisma from process.env (Vercel Storage)
 * and optional local .env files. Supports standard POSTGRES_* names, legacy
 * DATABASE_URL, and misconfigured DATABASE_URL_* Storage prefixes.
 */

export const PRISMA_GENERATE_PLACEHOLDER_URL =
  "postgresql://build:build@localhost:5432/build?schema=public";

const POOLED_URL_KEYS = [
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NO_SSL",
  "DATABASE_URL",
  "DATABASE_URL_DATABASE_URL",
  "DATABASE_URL_POSTGRES_URL",
  "DATABASE_URL_POSTGRES_PRISMA_URL",
  "NEON_DATABASE_URL",
  "NEON_POSTGRES_URL",
];

const DIRECT_URL_KEYS = [
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
  "DATABASE_URL_POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_POSTGRES_PRISMA_URL_NON_POOLING",
  "POSTGRES_URL",
  "POSTGRES_URL_NO_SSL",
];

const POSTGRES_ENV_KEY_RE =
  /POSTGRES|DATABASE|NEON|^PG(?:HOST|USER|PASSWORD|DATABASE|PORT|URL)/i;

function firstNonEmpty(...values) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export function isVercel() {
  return process.env.VERCEL === "1";
}

export function isPostgresUrl(value) {
  const trimmed = value?.trim();
  return Boolean(trimmed && /^postgres(ql)?:\/\//i.test(trimmed));
}

export function listPostgresRelatedEnvKeys() {
  return Object.keys(process.env)
    .filter((key) => POSTGRES_ENV_KEY_RE.test(key))
    .sort();
}

function valueFromKeys(keys) {
  for (const key of keys) {
    if (isPostgresUrl(process.env[key])) return process.env[key].trim();
  }
  return "";
}

function valueFromEnvScan(preferDirect = false) {
  const keys = listPostgresRelatedEnvKeys();
  const direct = [];
  const pooled = [];
  const other = [];

  for (const key of keys) {
    const value = process.env[key];
    if (!isPostgresUrl(value)) continue;
    if (/NON_POOLING|UNPOOLED|DIRECT/i.test(key)) direct.push(value.trim());
    else if (/PRISMA|PGBOUNCER|POOL/i.test(key)) pooled.push(value.trim());
    else other.push(value.trim());
  }

  if (preferDirect) return firstNonEmpty(...direct, ...other, ...pooled);
  return firstNonEmpty(...pooled, ...other, ...direct);
}

function buildUrlFromParts() {
  const host = firstNonEmpty(
    process.env.POSTGRES_HOST,
    process.env.PGHOST,
    process.env.DATABASE_URL_POSTGRES_HOST,
  );
  const user = firstNonEmpty(process.env.POSTGRES_USER, process.env.PGUSER);
  const password = firstNonEmpty(process.env.POSTGRES_PASSWORD, process.env.PGPASSWORD);
  const database = firstNonEmpty(
    process.env.POSTGRES_DATABASE,
    process.env.PGDATABASE,
    "neondb",
  );

  if (!host || !user || !password) return "";

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}/${database}?sslmode=require`;
}

export function resolvePostgresEnv() {
  const fromParts = buildUrlFromParts();

  const prismaUrl = firstNonEmpty(
    valueFromKeys(POOLED_URL_KEYS),
    fromParts,
    valueFromEnvScan(false),
  );

  const directUrl = firstNonEmpty(
    valueFromKeys(DIRECT_URL_KEYS),
    fromParts,
    prismaUrl,
    valueFromEnvScan(true),
  );

  if (prismaUrl) process.env.POSTGRES_PRISMA_URL = prismaUrl;
  if (directUrl) process.env.POSTGRES_URL_NON_POOLING = directUrl;

  return { prismaUrl, directUrl };
}

export function hasPostgresEnv() {
  const { prismaUrl, directUrl } = resolvePostgresEnv();
  return isPostgresUrl(prismaUrl) && isPostgresUrl(directUrl);
}

export function preparePostgresEnvForPush() {
  const relatedKeys = listPostgresRelatedEnvKeys();
  const { prismaUrl, directUrl } = resolvePostgresEnv();
  return {
    ok: isPostgresUrl(prismaUrl) && isPostgresUrl(directUrl),
    prismaUrl,
    directUrl,
    relatedKeys,
  };
}

/** prisma generate never connects; use safe placeholders so install/build always succeed. */
export function applyPrismaGenerateEnv() {
  process.env.POSTGRES_PRISMA_URL = PRISMA_GENERATE_PLACEHOLDER_URL;
  process.env.POSTGRES_URL_NON_POOLING = PRISMA_GENERATE_PLACEHOLDER_URL;
}

export function formatMissingPostgresEnvError({ loadedFiles = [] } = {}) {
  const relatedKeys = listPostgresRelatedEnvKeys();
  const lines = ["", "Missing Postgres connection env vars for Prisma."];

  if (relatedKeys.length > 0) {
    lines.push(`  Env keys present (values hidden): ${relatedKeys.join(", ")}`);
    lines.push("  None of these keys contain a valid postgresql:// or postgres:// URL.");
  } else if (isVercel()) {
    lines.push("  No POSTGRES_* / DATABASE_* / NEON_* keys in process.env during Vercel build.");
  } else if (loadedFiles.length === 0) {
    lines.push("  No .env, .env.local, or .env.vercel.local found in project root.");
  } else {
    lines.push(
      `  Loaded: ${loadedFiles.join(", ")} — but no valid Postgres URL found in process.env.`,
    );
  }

  lines.push("");

  if (isVercel()) {
    lines.push("Vercel fix (process.env — not .env files):");
    lines.push("  1. Project → Storage → Postgres → Connect to Project");
    lines.push("     Use blank env var prefix (not DATABASE_URL)");
    lines.push("  2. Settings → Environment Variables → Production must include:");
    lines.push("     POSTGRES_URL, POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING");
    lines.push("  3. Each Storage var must be enabled for Build (not Runtime-only)");
    lines.push("  4. Redeploy with RUN_DB_SETUP_ON_DEPLOY=true");
  } else {
    lines.push("Local fix:");
    lines.push("  1. Vercel → Storage → Postgres → .env.local tab");
    lines.push("     Copy POSTGRES_PRISMA_URL and POSTGRES_URL_NON_POOLING");
    lines.push("  2. Paste into .env.vercel.local (see .env.vercel.local.example)");
    lines.push("  3. Run: .\\scripts\\setup-prod-db.ps1   or   npm run db:push");
    lines.push("");
    lines.push("Or: npm run db:push / node scripts/prisma-with-env.mjs db push");
  }

  lines.push("");
  return lines.join("\n");
}
