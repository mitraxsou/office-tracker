import { isBreakglassEmail } from "@/lib/breakglass";
import { OnboardingForm } from "@/components/OnboardingForm";
import { SetInitialPasswordForm } from "@/components/SetInitialPasswordForm";
import {
  canSetInitialPassword,
  ensureUserInstallCommands,
} from "@/lib/auth";
import { peekInstallToken } from "@/lib/welcome-token";
import { requireAuthenticatedUser, enforceTermsAcceptanceIfRequired } from "@/lib/session-guards";
import { getRealCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getUserHoursTarget, getAppConfig } from "@/lib/app-config";
import { getEnrichedDevicesForUser } from "@/lib/device-enrichment";
import { getUserTimezoneRequestState } from "@/lib/timezone-requests";
import {
  getProfileChangeBlockReason,
  getUserProfileChangeRequestState,
} from "@/lib/profile-change-requests";
import { AppNav } from "@/components/AppNav";
import { SettingsPageClient } from "@/components/SettingsPageClient";
import { PriorComplianceSettings } from "@/components/PriorComplianceSettings";
import { AGENT_PRODUCT_NAME } from "@/lib/agent-branding";
import { needsPriorComplianceOnboarding } from "@/lib/prior-compliance";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; mustChange?: string }>;
}) {
  const user = await requireAuthenticatedUser();
  const realUser = await getRealCurrentUser();
  const adminAccess = isAdmin(realUser ?? user);

  const params = await searchParams;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const localDevAgentPath = process.env.AGENT_INSTALL_PATH || null;
  const hoursTarget = await getUserHoursTarget(user);
  const config = await getAppConfig();

  const sessionInstallToken = await peekInstallToken();
  const { installTokens, legacyBoundCount } = await ensureUserInstallCommands(
    user.id,
    appUrl,
    sessionInstallToken,
  );
  const enrichedDevices = await getEnrichedDevicesForUser(user.id);
  const timezoneRequestState = await getUserTimezoneRequestState(user.id);
  const profileChangeState = await getUserProfileChangeRequestState(user.id);
  const isBreakglass = isBreakglassEmail(user.email);
  const profileChangeBlockedMessage = getProfileChangeBlockReason(user.email);
  const mustChangePassword =
    !isBreakglass && (user.mustChangePassword || params.mustChange === "1");
  const showOnboarding = params.welcome === "1";
  const showInitialPassword =
    !isBreakglass && !mustChangePassword && canSetInitialPassword(user);
  const needsPriorComplianceStep =
    showOnboarding && (await needsPriorComplianceOnboarding(user.id));
  if (!mustChangePassword) {
    const settingsNext = params.welcome === "1" ? "/settings?welcome=1" : "/settings";
    await enforceTermsAcceptanceIfRequired(user, settingsNext);
  }

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

        {showOnboarding && (
          <OnboardingForm
            currentEmail={user.email}
            currentName={user.name}
            canSetPassword={showInitialPassword}
            timezone={user.timezone}
            needsPriorComplianceStep={needsPriorComplianceStep}
          />
        )}

        {!showOnboarding && <PriorComplianceSettings timezone={user.timezone} />}

        {!showOnboarding && showInitialPassword && <SetInitialPasswordForm />}

        <SettingsPageClient
          timezone={user.timezone}
          hoursTarget={hoursTarget}
          monthlyDaysTarget={config.monthlyDaysTarget}
          appUrl={appUrl}
          adminAccess={adminAccess}
          isWelcome={params.welcome === "1"}
          devices={enrichedDevices}
          installTokens={installTokens}
          legacyBoundCount={legacyBoundCount}
          localDevAgentPath={localDevAgentPath}
          timezoneRequestState={timezoneRequestState}
          profileChangeState={profileChangeState}
          currentName={user.name}
          currentEmail={user.email}
          profileChangeBlocked={!!profileChangeBlockedMessage}
          profileChangeBlockedMessage={profileChangeBlockedMessage}
          lockSettings={mustChangePassword}
          showChangePassword={!showInitialPassword}
          changePasswordRequired={mustChangePassword}
          isBreakglass={isBreakglass}
        />
      </main>
    </>
  );
}
