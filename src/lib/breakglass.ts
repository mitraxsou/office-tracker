import { prisma } from "./db";
import { hashPassword, ensureAgentToken } from "./auth";

export const BREAKGLASS_EMAIL = "admin@pwc.office";
export const BREAKGLASS_PASSWORD = "OfficeTracker!2026";

export async function ensureBreakglassAdmin() {
  const email = BREAKGLASS_EMAIL.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (existing.role !== "admin") {
      await prisma.user.update({ where: { id: existing.id }, data: { role: "admin" } });
    }
    return existing;
  }

  const passwordHash = await hashPassword(BREAKGLASS_PASSWORD);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "admin",
      name: "Breakglass Admin",
    },
  });

  await ensureAgentToken(user.id);
  return user;
}
