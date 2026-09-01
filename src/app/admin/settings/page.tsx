import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getAppConfig } from "@/lib/app-config";
import { isRegistrationEnvLocked } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";
import { AdminSettingsForm } from "@/components/AdminSettingsForm";
import { AdminPilotControls } from "@/components/AdminPilotControls";
import { AdminSubNav } from "@/components/AdminSubNav";
import { AdminIntegrationKeys } from "@/components/AdminIntegrationKeys";
import { listIntegrationApiKeys } from "@/lib/integration-api-keys";

export default async function AdminSettingsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const config = await getAppConfig();
  const integrationKeys = await listIntegrationApiKeys();

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Global settings</h1>
          <p className="text-sm text-muted">Hours target and office SSIDs for all users</p>
        </div>
        <AdminSubNav active="settings" />
        <AdminSettingsForm
          hoursTarget={config.hoursTarget}
          officeSsids={config.officeSsids}
          maxDevicesPerUser={config.maxDevicesPerUser}
          pendingTokenTtlDays={config.pendingTokenTtlDays}
          heartbeatRetentionDays={config.heartbeatRetentionDays}
          agentStaleMinutes={config.agentStaleMinutes}
        />
        <AdminIntegrationKeys initialKeys={integrationKeys} />
        <AdminPilotControls
          allowRegistration={config.allowRegistration}
          registrationEnvLocked={isRegistrationEnvLocked()}
        />
      </main>
    </>
  );
}
