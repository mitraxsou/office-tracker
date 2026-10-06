"use client";

import { useEffect, useState } from "react";
import { AgentStatusPanel } from "@/components/AgentStatusPanel";
import { UserSettingsForm } from "@/components/UserSettingsForm";
import { NotificationPrefsForm } from "@/components/NotificationPrefsForm";
import { OutOfOfficeSection } from "@/components/OutOfOfficeSection";
import { AgentGraceSection } from "@/components/AgentGraceSection";
import { AgentSetupPanel } from "@/components/AgentSetupPanel";
import type { EnrichedDevice } from "@/lib/device-enrichment";
import type { InstallTokenForUser } from "@/lib/install-token-types";
import type { TimezoneRequestSummary } from "@/lib/timezone-requests";
import type { ProfileChangeRequestSummary } from "@/lib/profile-change-requests";
import { ProfileChangeSection } from "@/components/ProfileChangeSection";
import { PreferredNameSection } from "@/components/PreferredNameSection";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { SettingsLayout } from "@/components/SettingsLayout";
import { AgentActivityPanel } from "@/components/AgentActivityPanel";
import type { UserAgentVersionSummary } from "@/lib/agent-update";

type Device = EnrichedDevice;

type TimezoneRequestState = {
  openRequest: TimezoneRequestSummary | null;
  latestRequest: TimezoneRequestSummary | null;
};

type ProfileChangeState = {
  openRequest: ProfileChangeRequestSummary | null;
  requests: ProfileChangeRequestSummary[];
};

type SettingsPageClientProps = {
  timezone: string;
  hoursTarget: number;
  monthlyDaysTarget: number;
  appUrl: string;
  adminAccess?: boolean;
  isWelcome?: boolean;
  devices: Device[];
  agentVersionSummary: UserAgentVersionSummary;
  installTokens: InstallTokenForUser[];
  legacyBoundCount: number;
  localDevAgentPath?: string | null;
  timezoneRequestState: TimezoneRequestState;
  profileChangeState: ProfileChangeState;
  currentName: string | null;
  preferredName: string | null;
  currentEmail: string;
  profileChangeBlocked?: boolean;
  profileChangeBlockedMessage?: string | null;
  lockSettings?: boolean;
  showChangePassword?: boolean;
  changePasswordRequired?: boolean;
  isBreakglass?: boolean;
};

export function SettingsPageClient({
  timezone,
  hoursTarget,
  monthlyDaysTarget,
  appUrl,
  adminAccess = false,
  isWelcome,
  devices: initialDevices,
  agentVersionSummary,
  installTokens,
  legacyBoundCount,
  localDevAgentPath,
  timezoneRequestState,
  profileChangeState,
  currentName,
  preferredName,
  currentEmail,
  profileChangeBlocked,
  profileChangeBlockedMessage,
  lockSettings,
  showChangePassword = true,
  changePasswordRequired = false,
  isBreakglass = false,
}: SettingsPageClientProps) {
  const [devices, setDevices] = useState(initialDevices);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "install" || hash === "agent") {
      const el = document.getElementById("install");
      if (el) {
        window.requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    }
  }, []);

  const sharedFormProps = {
    timezone,
    hoursTarget,
    monthlyDaysTarget,
    isWelcome,
    devices,
    onDevicesChange: setDevices,
    timezoneRequestState,
  };

  const accountSection = (
    <>
      {showChangePassword && (
        <ChangePasswordForm required={changePasswordRequired} isBreakglass={isBreakglass} />
      )}
      {lockSettings ? (
        <p className="text-sm text-muted">
          Other settings are available after you set a new password in this section.
        </p>
      ) : (
        <>
          <UserSettingsForm
            {...sharedFormProps}
            isWelcome={false}
            sections={{ org: true, timezone: true, devices: false }}
          />
          <PreferredNameSection preferredName={preferredName} legalName={currentName} />
          <ProfileChangeSection
            currentName={currentName}
            currentEmail={currentEmail}
            profileChangeState={profileChangeState}
            blocked={profileChangeBlocked}
            blockedMessage={profileChangeBlockedMessage}
          />
        </>
      )}
    </>
  );

  return (
    <>
      <SettingsLayout
        adminAccess={adminAccess}
        isWelcome={isWelcome}
        accountOnly={lockSettings}
        sections={{
          agent: lockSettings ? null : (
              <>
                <AgentSetupPanel
                  appUrl={appUrl}
                  installTokens={installTokens}
                  legacyBoundCount={legacyBoundCount}
                  localDevAgentPath={localDevAgentPath}
                  adminAccess={adminAccess}
                  agentVersionSummary={agentVersionSummary}
                />
                <UserSettingsForm
                  {...sharedFormProps}
                  sections={{ org: false, timezone: false, devices: true }}
                />
                <AgentGraceSection />
              </>
            ),
            account: accountSection,
            notifications: lockSettings ? null : (
              <>
                <NotificationPrefsForm />
                <OutOfOfficeSection />
              </>
            ),
            diagnostics: lockSettings ? null : (
              <>
                <AgentActivityPanel />
                <AgentStatusPanel
                  installTokens={installTokens}
                  legacyBoundCount={legacyBoundCount}
                  appUrl={appUrl}
                />
              </>
            ),
          }}
        />
    </>
  );
}
