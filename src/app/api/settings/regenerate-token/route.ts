import { NextResponse } from "next/server";
import { getCurrentUser, regenerateAgentToken } from "@/lib/auth";
import { setInstallToken } from "@/lib/welcome-token";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plainToken } = await regenerateAgentToken(user.id);
  await setInstallToken(plainToken);
  return NextResponse.json({ token: plainToken });
}
