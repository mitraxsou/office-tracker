import { redirect } from "next/navigation";
import {
  getCurrentUser,
  getInstallTokensForUser,
} from "@/lib/auth";
import { getUserHoursTarget, getAppConfig } from "@/lib/app-config";
import { getEnrichedDevicesForUser } from "@/lib/device-enrichment";
import { AppNav } from "@/components/AppNav";
import { SettingsPageClient } from "@/components/SettingsPageClient";
import { AGENT_PRODUCT_NAME } from "@/lib/agent-branding";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const localDevAgentPath = process.env.AGENT_INSTALL_PATH || null;
  const hoursTarget = await getUserHoursTarget(user);
  const config = await getAppConfig();

  const installTokens = await getInstallTokensForUser(user.id, appUrl);
  const enrichedDevices = await getEnrichedDevicesForUser(user.id);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted">
            {AGENT_PRODUCT_NAME} agent, timezone, and your laptops.
          </p>
        </div>

        <SettingsPageClient
          timezone={user.timezone}
          hoursTarget={hoursTarget}
          monthlyDaysTarget={config.monthlyDaysTarget}
          appUrl={appUrl}
          isWelcome={params.welcome === "1"}
          devices={enrichedDevices}
          installTokens={installTokens}
          localDevAgentPath={localDevAgentPath}
        />
      </main>
    </>
  );
}
