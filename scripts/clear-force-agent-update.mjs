/**
 * Clear AgentDevice.forceAgentUpdate for every device still flagged.
 *
 * Usage (Hobby prod Neon):
 *   $env:OFFICETRACKER_ENV_PROFILE = "prod"
 *   $env:CONFIRM_PROD = "yes"
 *   node scripts/clear-force-agent-update.mjs
 */

import { PrismaClient } from "@prisma/client";
import { loadEnvFiles } from "./load-env-files.mjs";
import { preparePostgresEnvForPush } from "./resolve-postgres-env.mjs";

async function main() {
  if (process.env.CONFIRM_PROD !== "yes") {
    console.error('Refusing to run without CONFIRM_PROD=yes (targets production Neon).');
    process.exit(1);
  }

  loadEnvFiles();
  const prepared = preparePostgresEnvForPush();
  if (!prepared.ok) {
    console.error("Postgres env not resolved for profile. Check .env.vercel.local / .env.vercel.prod.local");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const before = await prisma.agentDevice.count({
      where: { forceAgentUpdate: true },
    });
    const result = await prisma.agentDevice.updateMany({
      where: { forceAgentUpdate: true },
      data: { forceAgentUpdate: false },
    });
    const after = await prisma.agentDevice.count({
      where: { forceAgentUpdate: true },
    });
    console.log(
      JSON.stringify({
        ok: true,
        forcedBefore: before,
        cleared: result.count,
        forcedAfter: after,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
