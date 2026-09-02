import { isBreakglassEmail } from "./breakglass-shared";

export function getImpersonationBlockReason(params: {
  admin: { id: string; role: string } | null;
  target: { id: string; email: string } | null;
}): string | null {
  if (!params.admin || params.admin.role !== "admin") {
    return "Forbidden";
  }
  if (!params.target) {
    return "User not found";
  }
  if (params.target.id === params.admin.id) {
    return "Cannot impersonate yourself";
  }
  if (isBreakglassEmail(params.target.email)) {
    return "Cannot impersonate breakglass account";
  }
  return null;
}
