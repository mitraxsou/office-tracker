export async function register() {
  // DB seeding runs at server startup only — not during `next build`
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const hasDb = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
  if (!hasDb) return;

  const { ensureBreakglassAdmin } = await import("./lib/breakglass");
  const { ensureAppConfig } = await import("./lib/app-config");
  try {
    await ensureAppConfig();
    await ensureBreakglassAdmin();
  } catch (err) {
    console.error("[startup] breakglass/config init failed:", err);
  }
}
