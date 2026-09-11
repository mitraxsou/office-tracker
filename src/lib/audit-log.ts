import { prisma } from "./db";

export type AuditAction =
  | "visit_create"
  | "visit_update"
  | "visit_delete"
  | "device_remove"
  | "device_remove_self"
  | "config_update"
  | "user_role_change"
  | "db_reset"
  | "user_create"
  | "agent_token_issue"
  | "agent_token_share"
  | "agent_token_reissue"
  | "agent_token_revoke"
  | "agent_device_registered"
  | "user_data_reset"
  | "user_delete"
  | "heartbeat_purge"
  | "agent_stale_email"
  | "integration_alert"
  | "visit_correction_request"
  | "visit_report_resolve"
  | "integration_key_create"
  | "integration_key_revoke"
  | "admin_ooo_update"
  | "admin_notification_prefs_update"
  | "admin_custom_notification"
  | "device_removal_request"
  | "device_removal_approve"
  | "device_removal_reject"
  | "visit_correction_reply"
  | "data_purge"
  | "timezone_change_request"
  | "timezone_change_cancel"
  | "timezone_change_approve"
  | "timezone_change_reject"
  | "profile_change_request"
  | "profile_change_request_admin"
  | "profile_change_cancel"
  | "profile_change_approve"
  | "profile_change_reject"
  | "password_reset"
  | "agent_update_push"
  | "agent_deregister"
  | "admin_agent_grace_update"
  | "admin_profile_edit"
  | "compliance_exemption_request"
  | "compliance_exemption_cancel"
  | "compliance_exemption_approve"
  | "compliance_exemption_reject"
  | "impersonate_start"
  | "impersonate_end"
  | "otp_request"
  | "otp_verify_failed"
  | "user_create_otp"
  | "terms.accepted"
  | "legal.publish"
  | "admin_contact_submit"
  | "admin_contact_message"
  | "admin_contact_close"
  | "admin_contact_reopen"
  | "prior_compliance_request"
  | "prior_compliance_cancel"
  | "prior_compliance_approve"
  | "prior_compliance_reject"
  | "manual_visit_request"
  | "manual_visit_approve"
  | "manual_visit_reject";

export async function logAuditEvent(params: {
  actorId: string;
  action: AuditAction;
  targetUserId?: string | null;
  details?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      targetUserId: params.targetUserId ?? null,
      details: params.details ? JSON.stringify(params.details) : null,
    },
  });
}

export async function getRecentAuditLogs(limit = 20) {
  const logs = await prisma.auditLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      actor: { select: { email: true, name: true } },
      targetUser: { select: { email: true, name: true } },
    },
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    createdAt: log.createdAt.toISOString(),
    actorEmail: log.actor.email,
    targetEmail: log.targetUser?.email ?? null,
    details: log.details ? (JSON.parse(log.details) as Record<string, unknown>) : null,
  }));
}
