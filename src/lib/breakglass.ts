import { prisma } from "./db";
import { hashPassword, ensureAgentToken } from "./auth";

function getBreakglassCredentials(): { email: string; password: string } | null {
  const email = process.env.BREAKGLASS_EMAIL?.toLowerCase().trim();
  const password = process.env.BREAKGLASS_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export async function ensureBreakglassAdmin() {
  const creds = getBreakglassCredentials();
  if (!creds) return null;

  const existing = await prisma.user.findUnique({ where: { email: creds.email } });

  if (existing) {
    if (existing.role !== "admin") {
      await prisma.user.update({ where: { id: existing.id }, data: { role: "admin" } });
    }
    return existing;
  }

  const passwordHash = await hashPassword(creds.password);
  const user = await prisma.user.create({
    data: {
      email: creds.email,
      passwordHash,
      role: "admin",
      name: "Breakglass Admin",
    },
  });

  await ensureAgentToken(user.id);
  return user;
}
