import { requireAuthenticatedUser, enforcePasswordChangeIfRequired, enforceTermsAcceptanceIfRequired } from "@/lib/session-guards";
import { AppNav } from "@/components/AppNav";
import { UserReportsDashboard } from "@/components/UserReportsDashboard";

export default async function ReportsPage() {
  const user = await requireAuthenticatedUser();
  enforcePasswordChangeIfRequired(user);
  await enforceTermsAcceptanceIfRequired(user, "/reports");

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted">
            Explore your office hours. Hover charts for details, click bars to filter visits.
          </p>
        </div>
        <UserReportsDashboard />
      </main>
    </>
  );
}
