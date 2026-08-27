"use client";

import { useState } from "react";
import { AgentStatusPanel } from "@/components/AgentStatusPanel";
import { UserSettingsForm } from "@/components/UserSettingsForm";
import { AgentSetupPanel } from "@/components/AgentSetupPanel";

type Device = {
  id: string;
  serialNumber: string;
  label: string | null;
  lastSeenAt: string | null;
  createdAt: string;
};

type SettingsPageClientProps = {
  timezone: string;
  hoursTarget: number;
  officeSsids: string[];
  maskedToken: string;
  appUrl: string;
  initialPlainToken?: string | null;
  isWelcome?: boolean;
  devices: Device[];
  localDevAgentPath?: string | null;
};

export function SettingsPageClient({
  timezone,
  hoursTarget,
  officeSsids,
  maskedToken,
  appUrl,
  initialPlainToken,
  isWelcome,
  devices,
  localDevAgentPath,
}: SettingsPageClientProps) {
  const [plainToken, setPlainToken] = useState<string | null>(initialPlainToken ?? null);

  return (
    <>
      <AgentStatusPanel />

      <UserSettingsForm
        timezone={timezone}
        hoursTarget={hoursTarget}
        officeSsids={officeSsids}
        maskedToken={maskedToken}
        appUrl={appUrl}
        plainToken={plainToken}
        onPlainTokenChange={setPlainToken}
        isWelcome={isWelcome}
        devices={devices}
      />

      <AgentSetupPanel
        appUrl={appUrl}
        plainToken={plainToken}
        localDevAgentPath={localDevAgentPath}
      />
    </>
  );
}
