export const BREAKGLASS_PASSWORD_ENV_MESSAGE =
  "Breakglass password is managed via server environment";

export function isBreakglassEmail(email: string): boolean {
  const breakglassEmail = process.env.BREAKGLASS_EMAIL?.toLowerCase().trim();
  if (!breakglassEmail) return false;
  return email.toLowerCase().trim() === breakglassEmail;
}
