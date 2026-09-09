import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { sendTestNotification } from "@/lib/power-automate-notify";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await sendTestNotification({
    email: admin.email,
    name: admin.name,
  });
  if (!result.sent) {
    const message =
      result.reason === "not_configured"
        ? "Configure POWER_AUTOMATE_WEBHOOK_URL and POWER_AUTOMATE_WEBHOOK_SECRET (or generate an active DB secret)."
        : "Power Automate did not accept the test notification.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
