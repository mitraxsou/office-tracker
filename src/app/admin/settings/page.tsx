import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { enforcePasswordChangeIfRequired } from "@/lib/session-guards";
import { getAppConfig } from "@/lib/app-config";
import { isRegistrationEnvLocked } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";
import { AdminSettingsForm } from "@/components/AdminSettingsForm";
import { AdminPilotControls } from "@/components/AdminPilotControls";
import { AdminSubNav } from "@/components/AdminSubNav";
import { AdminComplianceExemptionControls } from "@/components/AdminComplianceExemptionControls";
import { AdminIntegrationKeys } from "@/components/AdminIntegrationKeys";
import { AdminMaintenance } from "@/components/AdminMaintenance";
import { listIntegrationApiKeys } from "@/lib/integration-api-keys";
import { AdminCronJobs } from "@/components/AdminCronJobs";
import { listCronJobs } from "@/lib/cron-jobs";
import { AdminDatabaseStats } from "@/components/AdminDatabaseStats";
import { getDatabaseStats } from "@/lib/db-stats";

export default async function AdminSettingsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");
  enforcePasswordChangeIfRequired(admin);

  const [config, integrationKeys, cronJobs, databaseStats] = await Promise.all([
    getAppConfig(),
    listIntegrationApiKeys(),
    listCronJobs(),
    getDatabaseStats(),
  ]);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Global settings</h1>
          <p className="text-sm text-muted">Hours and monthly days targets, office SSIDs for all users</p>
        </div>
        <AdminSubNav active="settings" />
        <AdminSettingsForm
          hoursTarget={config.hoursTarget}
          monthlyDaysTarget={config.monthlyDaysTarget}
          officeSsids={config.officeSsids}
          maxDevicesPerUser={config.maxDevicesPerUser}
          pendingTokenTtlDays={config.pendingTokenTtlDays}
          heartbeatRetentionDays={config.heartbeatRetentionDays}
          agentStaleMinutes={config.agentStaleMinutes}
          agentStaleGraceHours={config.agentStaleGraceHours}
        />
        <AdminComplianceExemptionControls
          complianceExemptionRequiresApproval={config.complianceExemptionRequiresApproval}
        />
        <AdminCronJobs initialJobs={cronJobs} />
        <AdminIntegrationKeys
          initialKeys={integrationKeys}
          webhookConfigured={Boolean(process.env.POWER_AUTOMATE_WEBHOOK_URL?.trim())}
        />
        <AdminDatabaseStats stats={databaseStats} />
        <AdminMaintenance />
        <AdminPilotControls
          allowRegistration={config.allowRegistration}
          registrationEnvLocked={isRegistrationEnvLocked()}
        />
      </main>
    </>
  );
}
