import { prisma } from "./db";

export async function revokeExpiredPendingTokens() {
  const now = new Date();
  const result = await prisma.agentToken.updateMany({
    where: {
      revokedAt: null,
      boundSerialNumber: null,
      expiresAt: { lt: now },
    },
    data: {
      revokedAt: now,
      pendingTokenEnc: null,
    },
  });
  return result.count;
}

export function isTokenExpired(token: {
  expiresAt: Date | null;
  boundSerialNumber: string | null;
  revokedAt: Date | null;
}) {
  if (token.revokedAt) return true;
  if (token.boundSerialNumber) return false;
  if (!token.expiresAt) return false;
  return token.expiresAt.getTime() < Date.now();
}
