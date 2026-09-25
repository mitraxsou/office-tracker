import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { enforcePasswordChangeIfRequired, enforceTermsAcceptanceIfRequired } from "@/lib/session-guards";
import { getAppConfig } from "@/lib/app-config";
import { AppNav } from "@/components/AppNav";
import { AdminDashboard } from "@/components/AdminDashboard";
import { AdminSubNav } from "@/components/AdminSubNav";

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");
  enforcePasswordChangeIfRequired(admin);
  await enforceTermsAcceptanceIfRequired(admin, "/admin");

  const config = await getAppConfig();

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header className="page-hero">
          <h1 className="text-2xl font-semibold">Admin reports</h1>
          <p className="mt-1 text-sm text-muted">
            Interactive charts, date filters, and drill-down. Hover for tooltips, click bars to
            filter by day.
          </p>
        </header>
        <AdminSubNav active="reports" />
        <AdminDashboard
          fiscalYearStartMonth={config.fiscalYearStartMonth}
          fiscalYearEndMonth={config.fiscalYearEndMonth}
        />
      </main>
    </>
  );
}
