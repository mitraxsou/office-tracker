import { prisma } from "./db";
import { hashPassword, ensureAgentToken } from "./auth";

export { isBreakglassEmail, BREAKGLASS_PASSWORD_ENV_MESSAGE } from "./breakglass-shared";

function getBreakglassCredentials(): { email: string; password: string } | null {
  const email = process.env.BREAKGLASS_EMAIL?.toLowerCase().trim();
  const password = process.env.BREAKGLASS_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export async function ensureBreakglassAdmin() {
  const creds = getBreakglassCredentials();
  if (!creds) return null;

  const passwordHash = await hashPassword(creds.password);
  const existing = await prisma.user.findUnique({ where: { email: creds.email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        role: "admin",
        mustChangePassword: false,
      },
    });
    return prisma.user.findUnique({ where: { id: existing.id } });
  }

  const user = await prisma.user.create({
    data: {
      email: creds.email,
      passwordHash,
      role: "admin",
      name: "Breakglass Admin",
      mustChangePassword: false,
    },
  });

  await ensureAgentToken(user.id);
  return user;
}
