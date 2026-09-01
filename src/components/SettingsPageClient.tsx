"use client";

import { useState } from "react";
import { AgentStatusPanel } from "@/components/AgentStatusPanel";
import { UserSettingsForm } from "@/components/UserSettingsForm";
import { NotificationPrefsForm } from "@/components/NotificationPrefsForm";
import { OutOfOfficeSection } from "@/components/OutOfOfficeSection";
import { AgentSetupPanel } from "@/components/AgentSetupPanel";
import { ThemePreference } from "@/components/ThemeToggle";
import type { EnrichedDevice } from "@/lib/device-enrichment";
import type { InstallTokenForUser } from "@/lib/install-token-types";

type Device = EnrichedDevice;

type SettingsPageClientProps = {
  timezone: string;
  hoursTarget: number;
  monthlyDaysTarget: number;
  appUrl: string;
  isWelcome?: boolean;
  devices: Device[];
  installTokens: InstallTokenForUser[];
  localDevAgentPath?: string | null;
};

export function SettingsPageClient({
  timezone,
  hoursTarget,
  monthlyDaysTarget,
  appUrl,
  isWelcome,
  devices: initialDevices,
  installTokens,
  localDevAgentPath,
}: SettingsPageClientProps) {
  const [devices, setDevices] = useState(initialDevices);

  return (
    <>
      <AgentStatusPanel />

      <ThemePreference className="mb-6" />

      <UserSettingsForm
        timezone={timezone}
        hoursTarget={hoursTarget}
        monthlyDaysTarget={monthlyDaysTarget}
        appUrl={appUrl}
        isWelcome={isWelcome}
        devices={devices}
        installTokens={installTokens}
        onDevicesChange={setDevices}
      />

      <NotificationPrefsForm />

      <OutOfOfficeSection />

      <AgentSetupPanel
        appUrl={appUrl}
        installTokens={installTokens}
        localDevAgentPath={localDevAgentPath}
      />
    </>
  );
}
