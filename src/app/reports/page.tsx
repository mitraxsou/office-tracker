import { Suspense } from "react";
import { requireAuthenticatedUser, enforcePasswordChangeIfRequired, enforceTermsAcceptanceIfRequired } from "@/lib/session-guards";
import { getAppConfig } from "@/lib/app-config";
import { AppNav } from "@/components/AppNav";
import { ReportsPageClient } from "@/components/ReportsPageClient";

export default async function ReportsPage() {
  const user = await requireAuthenticatedUser();
  enforcePasswordChangeIfRequired(user);
  await enforceTermsAcceptanceIfRequired(user, "/reports");

  const config = await getAppConfig();

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted">
            Explore your office hours, visit log, and correction requests. Summary shows charts and
            calendar; Visits supports reporting issues; Corrections tracks admin replies.
          </p>
        </div>
        <Suspense fallback={<p className="text-muted">Loading reports...</p>}>
          <ReportsPageClient
            fiscalYearStartMonth={config.fiscalYearStartMonth}
            fiscalYearEndMonth={config.fiscalYearEndMonth}
          />
        </Suspense>
      </main>
    </>
  );
}
