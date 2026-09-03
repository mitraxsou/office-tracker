export async function register() {
  // DB seeding runs at server startup only - not during `next build`
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation.node");
    await registerNode();
  }
}
