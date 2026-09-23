import { describe, it } from "vitest";

/**
 * MANUAL-001: live Windows force-reinstall.
 * Static guards live in BUG-002. Full process-kill + .setup.lock behavior needs a
 * PwC laptop and admin Push; see docs/agent-regression-matrix.md scenario C7.
 */
describe("MANUAL-001 Windows force-reinstall (documented)", () => {
  it.skip(
    "admin Push completes without stranding .setup.lock (run on Windows agent)",
    () => {
      // Intentionally empty: catalog keeps this visible; run laptop matrix instead.
    },
  );
});
