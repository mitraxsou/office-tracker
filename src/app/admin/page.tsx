import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { enforcePasswordChangeIfRequired } from "@/lib/session-guards";
import { AppNav } from "@/components/AppNav";
import { AdminDashboard } from "@/components/AdminDashboard";
import { AdminSubNav } from "@/components/AdminSubNav";

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");
  enforcePasswordChangeIfRequired(admin);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Admin reports</h1>
          <p className="text-sm text-muted">
            Interactive charts, date filters, and drill-down. Hover for tooltips, click bars to
            filter by day.
          </p>
        </div>
        <AdminSubNav active="reports" />
        <AdminDashboard />
      </main>
    </>
  );
}
