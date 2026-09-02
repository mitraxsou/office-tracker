import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { enforcePasswordChangeIfRequired } from "@/lib/session-guards";
import { AppNav } from "@/components/AppNav";
import { AdminSubNav } from "@/components/AdminSubNav";
import { AdminVisitReports } from "@/components/AdminVisitReports";
import { AdminDeviceRemovalRequests } from "@/components/AdminDeviceRemovalRequests";
import { AdminTimezoneChangeRequests } from "@/components/AdminTimezoneChangeRequests";

export default async function AdminVisitReportsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");
  enforcePasswordChangeIfRequired(admin);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">User requests</h1>
          <p className="text-sm text-muted">
            Visit corrections, timezone changes, and laptop removal requests from users.
          </p>
        </div>
        <AdminSubNav active="corrections" />
        <AdminTimezoneChangeRequests />
        <AdminDeviceRemovalRequests />
        <AdminVisitReports />
      </main>
    </>
  );
}
