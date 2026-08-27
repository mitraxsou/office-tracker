import { redirect } from "next/navigation";
import { ensureAgentToken, getCurrentUser, maskAgentToken } from "@/lib/auth";
import { getAppConfig, getUserHoursTarget } from "@/lib/app-config";
import { consumeWelcomeToken } from "@/lib/welcome-token";
import { AppNav } from "@/components/AppNav";
import { UserSettingsForm } from "@/components/UserSettingsForm";
import { AgentSetupPanel } from "@/components/AgentSetupPanel";
import { AGENT_PRODUCT_NAME } from "@/lib/agent-branding";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const welcomeToken = params.welcome === "1" ? await consumeWelcomeToken() : null;
  const { record, plainToken: newToken } = await ensureAgentToken(user.id);
  const displayToken = welcomeToken ?? newToken;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const localDevAgentPath = process.env.AGENT_INSTALL_PATH || null;
  const globalConfig = await getAppConfig();
  const hoursTarget = await getUserHoursTarget(user);

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

        <UserSettingsForm
          timezone={user.timezone}
          hoursTarget={hoursTarget}
          officeSsids={globalConfig.officeSsids}
          maskedToken={maskAgentToken(record.tokenPrefix)}
          appUrl={appUrl}
          initialPlainToken={displayToken}
          isWelcome={params.welcome === "1"}
          devices={user.agentDevices.map((d) => ({
            id: d.id,
            serialNumber: d.serialNumber,
            label: d.label,
            lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
            createdAt: d.createdAt.toISOString(),
          }))}
        />

        <AgentSetupPanel
          appUrl={appUrl}
          initialPlainToken={displayToken}
          localDevAgentPath={localDevAgentPath}
        />
      </main>
    </>
  );
}
