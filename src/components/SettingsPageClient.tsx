"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  installTokens: InstallTokenForUser[];
  legacyBoundCount: number;
  localDevAgentPath?: string | null;
  timezoneRequestState: TimezoneRequestState;
  profileChangeState: ProfileChangeState;
  currentName: string | null;
  currentEmail: string;
  profileChangeBlocked?: boolean;
  profileChangeBlockedMessage?: string | null;
  lockSettings?: boolean;
};

export function SettingsPageClient({
  timezone,
  hoursTarget,
  monthlyDaysTarget,
  appUrl,
  adminAccess = false,
  isWelcome,
  devices: initialDevices,
  installTokens,
  legacyBoundCount,
  localDevAgentPath,
  timezoneRequestState,
  profileChangeState,
  currentName,
  currentEmail,
  profileChangeBlocked,
  profileChangeBlockedMessage,
  lockSettings,
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

  return (
    <>
      {lockSettings ? (
        <p className="mb-6 text-sm text-muted">
          Other settings are available after you set a new password above.
        </p>
      ) : (
        <>
      <AgentSetupPanel
        appUrl={appUrl}
        installTokens={installTokens}
        legacyBoundCount={legacyBoundCount}
        localDevAgentPath={localDevAgentPath}
        adminAccess={adminAccess}
      />

      {adminAccess && (
        <AgentStatusPanel
          installTokens={installTokens}
          legacyBoundCount={legacyBoundCount}
          appUrl={appUrl}
        />
      )}

      <UserSettingsForm
        timezone={timezone}
        hoursTarget={hoursTarget}
        monthlyDaysTarget={monthlyDaysTarget}
        isWelcome={isWelcome}
        devices={devices}
        onDevicesChange={setDevices}
        timezoneRequestState={timezoneRequestState}
      />

      <ProfileChangeSection
        currentName={currentName}
        currentEmail={currentEmail}
        profileChangeState={profileChangeState}
        blocked={profileChangeBlocked}
        blockedMessage={profileChangeBlockedMessage}
      />

      <NotificationPrefsForm />

      <OutOfOfficeSection />

      <AgentGraceSection />
        </>
      )}
    </>
  );
}
