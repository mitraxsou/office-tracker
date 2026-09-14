"use client";



import { useMemo, type ReactNode } from "react";

import {

  SectionNavLayout,

  type SectionHashResolution,

} from "@/components/SectionNavLayout";



export type SettingsSectionId = "agent" | "account" | "notifications" | "diagnostics";



type SettingsLayoutProps = {

  adminAccess?: boolean;

  isWelcome?: boolean;

  accountOnly?: boolean;

  sections: {

    agent: ReactNode | null;

    account: ReactNode;

    notifications: ReactNode | null;

    diagnostics?: ReactNode | null;

  };

};



const SECTION_LABELS: Record<SettingsSectionId, string> = {

  agent: "Agent",

  account: "Account",

  notifications: "Notifications",

  diagnostics: "Diagnostics",

};



function resolveSettingsHash(

  rawHash: string,

  adminAccess: boolean,

  isWelcome: boolean,

  accountOnly: boolean,

): SectionHashResolution | null {

  if (accountOnly) {

    return { activeId: "account", scrollToId: "account" };

  }

  const h = rawHash.replace("#", "");

  if (h === "install") {

    return { activeId: "agent", scrollToId: "install" };

  }

  if (h === "agent" || h === "") {

    const activeId = "agent";

    if (!h && isWelcome) {

      return { activeId, scrollToId: "agent" };

    }

    if (h === "agent") {

      return { activeId, scrollToId: "agent" };

    }

    return null;

  }

  if (h === "account" || h === "notifications") {

    return { activeId: h, scrollToId: h };

  }

  if (h === "diagnostics" && adminAccess) {

    return { activeId: "diagnostics", scrollToId: "diagnostics" };

  }

  return null;

}



export function SettingsLayout({

  adminAccess = false,

  isWelcome,

  accountOnly = false,

  sections,

}: SettingsLayoutProps) {

  const navItems = useMemo(() => {

    if (accountOnly) {

      return [{ id: "account" as SettingsSectionId, label: SECTION_LABELS.account }];

    }

    const ids: SettingsSectionId[] = ["agent", "account", "notifications"];

    if (adminAccess) ids.push("diagnostics");

    return ids.map((id) => ({ id, label: SECTION_LABELS[id] }));

  }, [adminAccess, accountOnly]);



  const defaultActiveId = accountOnly ? "account" : "agent";



  const resolveHash = useMemo(

    () => (raw: string) =>

      resolveSettingsHash(raw, adminAccess, !!isWelcome, accountOnly),

    [adminAccess, isWelcome, accountOnly],

  );



  return (

    <SectionNavLayout

      items={navItems}

      navTitle="Settings section"

      defaultActiveId={defaultActiveId}

      resolveHash={resolveHash}

    >

      <div className="space-y-12">

        {sections.agent != null && (

          <section id="agent" className="scroll-mt-header space-y-6">

            <h2 className="text-lg font-medium">Agent</h2>

            {sections.agent}

          </section>

        )}



        <section id="account" className="scroll-mt-header space-y-6">

          <h2 className="text-lg font-medium">Account</h2>

          {sections.account}

        </section>



        {sections.notifications != null && (

          <section id="notifications" className="scroll-mt-header space-y-6">

            <h2 className="text-lg font-medium">Notifications</h2>

            {sections.notifications}

          </section>

        )}



        {adminAccess && sections.diagnostics != null && (

          <section id="diagnostics" className="scroll-mt-header space-y-6">

            <h2 className="text-lg font-medium">Diagnostics</h2>

            {sections.diagnostics}

          </section>

        )}

      </div>

    </SectionNavLayout>

  );

}


