import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { enforcePasswordChangeIfRequired } from "@/lib/session-guards";
import { prisma } from "@/lib/db";
import { getProfileChangeBlockReason } from "@/lib/profile-change-requests";
import { AppNav } from "@/components/AppNav";
import { AdminSubNav } from "@/components/AdminSubNav";
import { AdminUserReport } from "@/components/AdminUserReport";

export default async function AdminUserReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");
  enforcePasswordChangeIfRequired(admin);

  const { id } = await params;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { email: true },
  });
  const profileChangeBlockedMessage = target
    ? getProfileChangeBlockReason(target.email)
    : null;

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <AdminSubNav active="reports" />
        <AdminUserReport
          userId={id}
          profileChangeBlocked={!!profileChangeBlockedMessage}
          profileChangeBlockedMessage={profileChangeBlockedMessage}
        />
      </main>
    </>
  );
}
