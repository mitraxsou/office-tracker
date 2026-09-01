"use client";

import { useState } from "react";
import { AgentStatusPanel } from "@/components/AgentStatusPanel";
import { UserSettingsForm } from "@/components/UserSettingsForm";
import { NotificationPrefsForm } from "@/components/NotificationPrefsForm";
import { AgentSetupPanel } from "@/components/AgentSetupPanel";

type Device = {
  id: string;
  serialNumber: string;
  label: string | null;
  lastSeenAt: string | null;
  createdAt: string;
};

type PendingToken = {
  id: string;
  label: string | null;
  prefix: string;
  plainToken: string;
  installCommand: string;
  createdAt: string;
};

type BoundToken = {
  id: string;
  label: string | null;
  prefix: string;
  boundSerialNumber: string | null;
};

type SettingsPageClientProps = {
  timezone: string;
  hoursTarget: number;
  officeSsids: string[];
  appUrl: string;
  isWelcome?: boolean;
  devices: Device[];
  pendingTokens: PendingToken[];
  boundTokens: BoundToken[];
  localDevAgentPath?: string | null;
};

export function SettingsPageClient({
  timezone,
  hoursTarget,
  officeSsids,
  appUrl,
  isWelcome,
  devices: initialDevices,
  pendingTokens,
  boundTokens,
  localDevAgentPath,
}: SettingsPageClientProps) {
  const [devices, setDevices] = useState(initialDevices);
  const selectedInstallCommand = pendingTokens[0]?.installCommand ?? null;

  return (
    <>
      <AgentStatusPanel />

      <UserSettingsForm
        timezone={timezone}
        hoursTarget={hoursTarget}
        officeSsids={officeSsids}
        appUrl={appUrl}
        isWelcome={isWelcome}
        devices={devices}
        pendingTokens={pendingTokens}
        boundTokens={boundTokens}
        onDevicesChange={setDevices}
      />

      <NotificationPrefsForm />

      <AgentSetupPanel
        appUrl={appUrl}
        installCommand={selectedInstallCommand}
        localDevAgentPath={localDevAgentPath}
      />
    </>
  );
}
