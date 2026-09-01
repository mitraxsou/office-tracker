"use client";

import { useState } from "react";
import { AgentStatusPanel } from "@/components/AgentStatusPanel";
import { UserSettingsForm } from "@/components/UserSettingsForm";
import { NotificationPrefsForm } from "@/components/NotificationPrefsForm";
import { OutOfOfficeSection } from "@/components/OutOfOfficeSection";
import { AgentSetupPanel } from "@/components/AgentSetupPanel";
import type { EnrichedDevice } from "@/lib/device-enrichment";
import type { InstallTokenForUser } from "@/lib/install-token-types";

type Device = EnrichedDevice;

type SettingsPageClientProps = {
  timezone: string;
  hoursTarget: number;
  appUrl: string;
  isWelcome?: boolean;
  devices: Device[];
  installTokens: InstallTokenForUser[];
  localDevAgentPath?: string | null;
};

export function SettingsPageClient({
  timezone,
  hoursTarget,
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

      <UserSettingsForm
        timezone={timezone}
        hoursTarget={hoursTarget}
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
