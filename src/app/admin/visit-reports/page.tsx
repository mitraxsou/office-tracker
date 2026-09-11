import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { enforcePasswordChangeIfRequired, enforceTermsAcceptanceIfRequired } from "@/lib/session-guards";
import { AppNav } from "@/components/AppNav";
import { AdminSubNav } from "@/components/AdminSubNav";
import { AdminVisitReports } from "@/components/AdminVisitReports";
import { AdminComplianceExemptionRequests } from "@/components/AdminComplianceExemptionRequests";
import { AdminDeviceRemovalRequests } from "@/components/AdminDeviceRemovalRequests";
import { AdminTimezoneChangeRequests } from "@/components/AdminTimezoneChangeRequests";
import { AdminProfileChangeRequests } from "@/components/AdminProfileChangeRequests";
import { AdminContactSubmissions } from "@/components/AdminContactSubmissions";
import { AdminPriorComplianceRequests } from "@/components/AdminPriorComplianceRequests";
import { AdminManualVisitRequests } from "@/components/AdminManualVisitRequests";

export default async function AdminVisitReportsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");
  enforcePasswordChangeIfRequired(admin);
  await enforceTermsAcceptanceIfRequired(admin, "/admin/visit-reports");

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">User requests</h1>
          <p className="text-sm text-muted">
            Manual visit requests, visit corrections, timezone changes, profile changes, prior
            compliance declarations, HR exemption notifications, laptop removal requests, and
            reach-out-to-admin messages.
          </p>
        </div>
        <AdminSubNav active="corrections" />
        <div id="admin_contact" className="scroll-mt-6"><AdminContactSubmissions /></div>
        <div id="manual_visit" className="scroll-mt-6"><AdminManualVisitRequests /></div>
        <div id="timezone_change" className="scroll-mt-6"><AdminTimezoneChangeRequests /></div>
        <div id="profile_change" className="scroll-mt-6"><AdminProfileChangeRequests /></div>
        <div id="prior_compliance" className="scroll-mt-6"><AdminPriorComplianceRequests /></div>
        <div id="compliance_exemption" className="scroll-mt-6"><AdminComplianceExemptionRequests /></div>
        <div id="device_removal" className="scroll-mt-6"><AdminDeviceRemovalRequests /></div>
        <div id="visit_correction" className="scroll-mt-6"><AdminVisitReports /></div>
      </main>
    </>
  );
}
