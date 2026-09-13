/**
 * Pull Hobby Vercel env vars into local gitignored files.
 *
 *   npm run env:pull:dev
 *   npm run env:pull:prod
 *
 * Clears VERCEL_TOKEN if set (invalid tokens break vercel env pull on PwC laptops).
 */

import { spawnSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const HOBBY_TEAM_ID = "team_3LPxagkp9owYBE8nVXkQAg7H";

const PROFILES = {
  dev: {
    projectId: "prj_8e1WU41N2AV7BIaKDydrmeQ6oL2x",
    projectName: "office-tracker-dev",
    outputFile: ".env.vercel.dev.local",
  },
  prod: {
    projectId: "prj_Ay5vp88pkSDFYURvoX9zCip4k72c",
    projectName: "office-tracker",
    outputFile: ".env.vercel.prod.local",
  },
};

const profileArg = (process.argv[2] || "").trim().toLowerCase();
const profile = profileArg === "prod" || profileArg === "production" ? "prod" : profileArg === "dev" ? "dev" : null;

if (!profile) {
  console.error("Usage: node scripts/pull-hobby-env.mjs <dev|prod>");
  console.error("");
  console.error("  dev  - pull office-tracker-dev into .env.vercel.dev.local");
  console.error("  prod - pull office-tracker into .env.vercel.prod.local");
  process.exit(1);
}

const { projectId, projectName, outputFile } = PROFILES[profile];
const outputPath = resolve(repoRoot, outputFile);

if (process.env.VERCEL_TOKEN) {
  console.warn("Clearing VERCEL_TOKEN from this session (invalid tokens break vercel env pull).");
  delete process.env.VERCEL_TOKEN;
}

const env = {
  ...process.env,
  VERCEL_ORG_ID: HOBBY_TEAM_ID,
  VERCEL_PROJECT_ID: projectId,
  // PwC corporate TLS inspection breaks vercel env pull without this.
  NODE_TLS_REJECT_UNAUTHORIZED: "0",
};

console.log(`Pulling ${projectName} (${profile}) into ${outputFile} ...`);

const result = spawnSync(
  "npx",
  ["vercel", "env", "pull", outputPath, "--environment", "production", "-y"],
  { stdio: "inherit", env, cwd: repoRoot, shell: process.platform === "win32" },
);

if (result.status !== 0) {
  console.error("");
  console.error(`vercel env pull failed for ${projectName}.`);
  console.error("Manual copy: Vercel dashboard -> project -> Settings -> Environment Variables");
  if (profile === "dev") {
    console.error("  Save as .env.vercel.dev.local in the project root.");
  } else {
    console.error("  Save as .env.vercel.prod.local (and Postgres-only vars in .env.vercel.local if split).");
  }
  process.exit(result.status ?? 1);
}

console.log(`Wrote ${outputFile}`);
if (profile === "prod") {
  console.log("");
  console.log("Prod local profile also reads .env.vercel.local for Postgres-only Storage vars.");
  console.log("If POSTGRES_* is missing, copy Storage -> .env.local tab into .env.vercel.local.");
}
