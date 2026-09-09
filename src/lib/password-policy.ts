import { isBreakglassEmail, BREAKGLASS_PASSWORD_ENV_MESSAGE } from "./breakglass-shared";

export const MIN_PASSWORD_LENGTH = 8;

export const ADMIN_SELF_RESET_MESSAGE = "Ask another admin to reset your password";

export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}

export function getAdminPasswordResetBlockReason(params: {
  adminId: string;
  targetId: string;
  targetEmail: string;
}): string | null {
  if (params.adminId === params.targetId) {
    return ADMIN_SELF_RESET_MESSAGE;
  }
  if (isBreakglassEmail(params.targetEmail)) {
    return BREAKGLASS_PASSWORD_ENV_MESSAGE;
  }
  return null;
}

export function getSelfPasswordChangeBlockReason(email: string): string | null {
  if (isBreakglassEmail(email)) {
    return BREAKGLASS_PASSWORD_ENV_MESSAGE;
  }
  return null;
}

export function buildPasswordResetMailto(params: {
  userEmail: string;
  tempPassword: string;
  loginUrl: string;
}): string {
  const subject = encodeURIComponent("My Office Pulse - temporary password");
  const body = encodeURIComponent(
    [
      "Hello,",
      "",
      "Your My Office Pulse password has been reset.",
      "",
      `Temporary password: ${params.tempPassword}`,
      "",
      `Sign in at: ${params.loginUrl}`,
      "",
      "You will be asked to set a new password after signing in.",
      "",
      "If you did not expect this email, contact your pilot admin.",
    ].join("\n"),
  );
  return `mailto:${params.userEmail}?subject=${subject}&body=${body}`;
}
