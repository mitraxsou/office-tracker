import { getCurrentUser } from "./auth";

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}

export function isAdmin(user: { role: string }) {
  return user.role === "admin";
}
