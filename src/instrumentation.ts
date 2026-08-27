export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureBreakglassAdmin } = await import("./lib/breakglass");
    const { ensureAppConfig } = await import("./lib/app-config");
    try {
      await ensureAppConfig();
      await ensureBreakglassAdmin();
    } catch (err) {
      console.error("[startup] breakglass/config init failed:", err);
    }
  }
}
