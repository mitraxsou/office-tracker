import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { AppNav } from "@/components/AppNav";
import { AdminSubNav } from "@/components/AdminSubNav";
import { AdminVisitReports } from "@/components/AdminVisitReports";

export default async function AdminVisitReportsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Visit corrections</h1>
          <p className="text-sm text-muted">
            Review user-reported visit issues and correct data on their report.
          </p>
        </div>
        <AdminSubNav active="corrections" />
        <AdminVisitReports />
      </main>
    </>
  );
}
