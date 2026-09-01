"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  legacyBoundCount: number;
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
  legacyBoundCount,
  localDevAgentPath,
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
      <AgentStatusPanel
        installTokens={installTokens}
        legacyBoundCount={legacyBoundCount}
        appUrl={appUrl}
      />

      <AgentSetupPanel
        appUrl={appUrl}
        installTokens={installTokens}
        legacyBoundCount={legacyBoundCount}
        localDevAgentPath={localDevAgentPath}
      />

      <ThemePreference className="mb-6" />

      <UserSettingsForm
        timezone={timezone}
        hoursTarget={hoursTarget}
        monthlyDaysTarget={monthlyDaysTarget}
        isWelcome={isWelcome}
        devices={devices}
        onDevicesChange={setDevices}
      />

      <NotificationPrefsForm />

      <OutOfOfficeSection />
    </>
  );
}
