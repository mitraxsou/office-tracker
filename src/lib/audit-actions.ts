import type { AuditAction } from "./audit-log";
import { DEFAULT_TIMEZONE, timezoneOptionsForUser } from "./constants";

export type AuditActionGuide = {
  label: string;
  summary: string;
};

export const AUDIT_ACTION_GUIDE: Record<AuditAction, AuditActionGuide> = {
  visit_create: {
    label: "Visit created",
    summary: "An office visit row was added (admin correction, manual check-in, or agent Wi-Fi start).",
  },
  visit_update: {
    label: "Visit edited",
    summary: "Start, end, source, or SSID on an existing visit was changed.",
  },
  visit_delete: {
    label: "Visit deleted",
    summary: "A visit row was removed. Hours for that day recalculate without it.",
  },
  device_remove: {
    label: "Laptop removed",
    summary: "An admin removed a registered laptop from a user account.",
  },
  device_remove_self: {
    label: "Laptop self-removed",
    summary: "The user removed one of their own registered laptops.",
  },
  config_update: {
    label: "Global settings saved",
    summary: "Pilot-wide config changed (hours target, SSIDs, retention, agent interval, and similar).",
  },
  user_role_change: {
    label: "Role changed",
    summary: "A user was promoted to admin or demoted to a regular user.",
  },
  db_reset: {
    label: "Database reset",
    summary: "A destructive reset wiped operational data. Audit history from before the reset is gone.",
  },
  user_create: {
    label: "User created",
    summary: "An admin created an account (Users and tokens).",
  },
  agent_token_issue: {
    label: "Install token issued",
    summary: "A new laptop install token was created for a user.",
  },
  agent_token_share: {
    label: "Install command copied",
    summary: "Install or update commands were generated/shared for a token.",
  },
  agent_token_reissue: {
    label: "Install token reissued",
    summary: "The previous token was replaced so the user can run a fresh install or update command.",
  },
  agent_token_regenerate_request: {
    label: "Token regenerate requested",
    summary: "The user asked an admin to replace a laptop token. The old token still works until approved.",
  },
  agent_token_regenerate_cancel: {
    label: "Token regenerate cancelled",
    summary: "A pending token regenerate request was cancelled.",
  },
  agent_token_regenerate_approve: {
    label: "Token regenerate approved",
    summary: "An admin approved a token regenerate. The old token is revoked; the user must run the new reinstall command.",
  },
  agent_token_regenerate_reject: {
    label: "Token regenerate denied",
    summary: "An admin denied a token regenerate request. The existing laptop token stays in place.",
  },
  agent_token_revoke: {
    label: "Install token revoked",
    summary: "A pending or bound token was revoked and can no longer register a laptop.",
  },
  agent_device_registered: {
    label: "Laptop registered",
    summary: "The agent bound a BIOS serial to this account (first successful sync with that token).",
  },
  user_data_reset: {
    label: "User data reset",
    summary: "Tracking data for one user was cleared. Visits are kept for compliance.",
  },
  user_delete: {
    label: "User deleted",
    summary: "The user account was removed.",
  },
  heartbeat_purge: {
    label: "Heartbeat purge",
    summary: "Old diagnostic heartbeats/activity ticks were deleted by retention cron.",
  },
  agent_stale_email: {
    label: "Stale-agent email",
    summary: "A stale-agent notification was recorded as sent.",
  },
  integration_alert: {
    label: "Teams/email alert sent",
    summary:
      "A Power Automate alert was dispatched for this user. Actor and target are often the same person because the send is recorded on their account. See type in Details (hours_met, hours_started, stale, and similar).",
  },
  visit_correction_request: {
    label: "Visit correction requested",
    summary: "The user asked an admin to fix a visit.",
  },
  visit_report_resolve: {
    label: "Visit correction resolved",
    summary: "An admin approved, denied, or closed a visit correction request.",
  },
  integration_key_create: {
    label: "Integration API key created",
    summary: "A Power Automate / API key was issued.",
  },
  integration_key_revoke: {
    label: "Integration API key revoked",
    summary: "An integration API key was disabled.",
  },
  admin_ooo_update: {
    label: "Out-of-office updated",
    summary: "Out-of-office dates were changed for a user.",
  },
  admin_notification_prefs_update: {
    label: "Notification prefs updated",
    summary: "Teams/email alert preferences were changed.",
  },
  admin_custom_notification: {
    label: "Custom notification sent",
    summary: "An admin sent a one-off custom alert.",
  },
  device_removal_request: {
    label: "Laptop removal requested",
    summary: "The user asked to unregister a laptop.",
  },
  device_removal_approve: {
    label: "Laptop removal approved",
    summary: "An admin approved a laptop removal request.",
  },
  device_removal_reject: {
    label: "Laptop removal denied",
    summary: "An admin denied a laptop removal request.",
  },
  visit_correction_reply: {
    label: "Visit correction reply",
    summary: "A message was added on a visit correction thread.",
  },
  data_purge: {
    label: "Data maintenance purge",
    summary: "An admin ran Data maintenance and deleted old rows from a chosen table.",
  },
  timezone_change_request: {
    label: "Timezone change requested",
    summary: "The user asked to change their reporting timezone.",
  },
  timezone_change_cancel: {
    label: "Timezone change cancelled",
    summary: "A pending timezone request was cancelled.",
  },
  timezone_change_approve: {
    label: "Timezone change approved",
    summary: "An admin approved a timezone change.",
  },
  timezone_change_reject: {
    label: "Timezone change denied",
    summary: "An admin denied a timezone change.",
  },
  profile_change_request: {
    label: "Profile change requested",
    summary: "The user asked to change name or similar profile fields.",
  },
  profile_change_request_admin: {
    label: "Profile change (admin)",
    summary: "An admin submitted a profile change on behalf of a user.",
  },
  profile_change_cancel: {
    label: "Profile change cancelled",
    summary: "A pending profile request was cancelled.",
  },
  profile_change_approve: {
    label: "Profile change approved",
    summary: "An admin approved a profile change.",
  },
  profile_change_reject: {
    label: "Profile change denied",
    summary: "An admin denied a profile change.",
  },
  password_reset: {
    label: "Password reset",
    summary: "A password was reset (admin reset or self-service).",
  },
  agent_update_push: {
    label: "Agent update pushed",
    summary: "An admin queued a one-shot agent reinstall/update on a laptop.",
  },
  agent_update_clear: {
    label: "Agent update cleared",
    summary: "A pending forced agent update flag was cleared.",
  },
  agent_deregister: {
    label: "Agent deregistered",
    summary: "The user’s agent was deregistered so it should stop counting.",
  },
  admin_agent_grace_update: {
    label: "Agent grace updated",
    summary: "Per-user agent health grace hours were changed.",
  },
  admin_profile_edit: {
    label: "Profile edited by admin",
    summary: "An admin directly edited profile fields.",
  },
  compliance_exemption_request: {
    label: "HR exemption requested",
    summary: "The user asked for a monthly compliance exemption.",
  },
  compliance_exemption_cancel: {
    label: "HR exemption cancelled",
    summary: "A pending exemption request was cancelled.",
  },
  compliance_exemption_approve: {
    label: "HR exemption approved",
    summary: "An admin logged or approved a compliance exemption.",
  },
  compliance_exemption_reject: {
    label: "HR exemption denied",
    summary: "An admin denied a compliance exemption.",
  },
  impersonate_start: {
    label: "View as user started",
    summary: "An admin started impersonating this user for support.",
  },
  impersonate_end: {
    label: "View as user ended",
    summary: "The impersonation session ended.",
  },
  otp_request: {
    label: "Sign-in code requested",
    summary: "A one-time email code was requested for login or registration.",
  },
  otp_verify_failed: {
    label: "Sign-in code failed",
    summary: "The code was wrong, expired, or too many attempts were used.",
  },
  user_create_otp: {
    label: "User created via OTP",
    summary: "A new account was created after a successful email code (self-registration).",
  },
  "terms.accepted": {
    label: "Terms accepted",
    summary: "The user accepted the current terms/privacy version.",
  },
  "legal.publish": {
    label: "Legal text published",
    summary: "An admin published new terms or privacy text.",
  },
  admin_contact_submit: {
    label: "Contact admin submitted",
    summary: "A user opened a contact-admin thread.",
  },
  admin_contact_message: {
    label: "Contact admin message",
    summary: "A message was added on a contact-admin thread.",
  },
  admin_contact_close: {
    label: "Contact admin closed",
    summary: "A contact-admin thread was closed.",
  },
  admin_contact_reopen: {
    label: "Contact admin reopened",
    summary: "A contact-admin thread was reopened.",
  },
  prior_compliance_request: {
    label: "Prior compliance requested",
    summary: "The user declared prior-month office days for onboarding.",
  },
  prior_compliance_cancel: {
    label: "Prior compliance cancelled",
    summary: "A prior-compliance request was cancelled.",
  },
  prior_compliance_approve: {
    label: "Prior compliance approved",
    summary: "An admin approved a prior-compliance declaration.",
  },
  prior_compliance_reject: {
    label: "Prior compliance denied",
    summary: "An admin denied a prior-compliance declaration.",
  },
  manual_visit_request: {
    label: "Manual visit requested",
    summary: "The user asked an admin to add a manual office visit.",
  },
  manual_visit_approve: {
    label: "Manual visit approved",
    summary: "An admin approved a manual visit request.",
  },
  manual_visit_reject: {
    label: "Manual visit denied",
    summary: "An admin denied a manual visit request.",
  },
  "account_access.approved": {
    label: "Account access approved",
    summary: "An admin approved a pending account-access request.",
  },
  "account_access.rejected": {
    label: "Account access denied",
    summary: "An admin denied a pending account-access request.",
  },
};

export const INTEGRATION_ALERT_TYPE_GUIDE: Record<string, string> = {
  hours_met: "Daily office-hours target was met. Alert sent when that threshold was crossed.",
  hours_started: "Office time started for the day (first qualifying visit/activity).",
  monthly_snapshot: "Scheduled monthly compliance snapshot for this user.",
  ooo_cleared: "Out-of-office ended or was cleared; alerts may resume.",
  stale: "Agent looked stale (no recent sync) while not out of office.",
  absent: "No office visit on a workday by the alert cutoff.",
  behind: "On track to miss the daily hours target.",
  custom: "Admin-authored custom notification.",
};

const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function resolveAuditTimezone(requested: string | undefined, fallback: string): string {
  const base = isValidTimeZone(fallback?.trim()) ? fallback.trim() : DEFAULT_TIMEZONE;
  const value = requested?.trim();
  if (!value) return base;
  if (isValidTimeZone(value)) return value;
  return base;
}

function isValidTimeZone(value: string | undefined): boolean {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-IN", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function auditTimezoneOptions(current: string) {
  return [
    { value: "UTC", label: "UTC" },
    ...timezoneOptionsForUser(current === "UTC" ? DEFAULT_TIMEZONE : current),
  ];
}

export function describeAuditAction(action: string): AuditActionGuide {
  const known = AUDIT_ACTION_GUIDE[action as AuditAction];
  if (known) return known;
  return {
    label: action.replace(/[._]/g, " "),
    summary: "Recorded system or admin action. See Admin guide Audit log if this code is new.",
  };
}

export function auditActionGuideHref(action: string): string {
  return `/admin/guide#audit-action-${action.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
}

export function auditActionAnchorId(action: string): string {
  return `audit-action-${action.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
}

export function formatAuditTimestamp(iso: string, timezone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const zone = isValidTimeZone(timezone) ? timezone : DEFAULT_TIMEZONE;
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: zone,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZoneName: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function formatAuditDetailValue(value: unknown, timezone: string): string {
  if (typeof value === "string" && ISO_INSTANT.test(value)) {
    return formatAuditTimestamp(value, timezone);
  }
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function formatAuditDetailsSummary(
  details: string | null,
  timezone: string,
): string {
  if (!details) return "No details";
  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    return Object.entries(parsed)
      .slice(0, 4)
      .map(([key, value]) => `${key}: ${formatAuditDetailValue(value, timezone)}`)
      .join(", ");
  } catch {
    return details.slice(0, 240);
  }
}

export function integrationAlertTypeHelp(type: unknown): string | null {
  if (typeof type !== "string") return null;
  return INTEGRATION_ALERT_TYPE_GUIDE[type] ?? null;
}
