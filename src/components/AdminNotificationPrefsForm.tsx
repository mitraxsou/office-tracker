"use client";

import { useState } from "react";
import { NotificationPrefsForm } from "./NotificationPrefsForm";
import { OutOfOfficeSection } from "./OutOfOfficeSection";
import { AgentGraceSection } from "./AgentGraceSection";
import { AdminCustomNotificationForm } from "./AdminCustomNotificationForm";

type Props = {
  userId: string;
  userEmail: string;
};

export function AdminNotificationPrefsForm({ userId, userEmail }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium"
        aria-expanded={open}
      >
        <span>Notifications and out of office</span>
        <span className="text-xs text-muted">{open ? "Hide" : "Manage"}</span>
      </button>
      {!open && (
        <p className="mt-1 text-xs text-muted">
          Send a custom notification, set alert channels, office schedule, and out-of-office days
          for {userEmail}
        </p>
      )}
      {open && (
        <div className="mt-4 space-y-4">
          <AdminCustomNotificationForm userId={userId} userEmail={userEmail} />
          <OutOfOfficeSection adminUserId={userId} />
          <AgentGraceSection adminUserId={userId} />
          <NotificationPrefsForm adminUserId={userId} />
        </div>
      )}
    </div>
  );
}
