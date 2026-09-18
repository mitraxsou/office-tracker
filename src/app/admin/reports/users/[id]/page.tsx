import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { enforcePasswordChangeIfRequired, enforceTermsAcceptanceIfRequired } from "@/lib/session-guards";
import { prisma } from "@/lib/db";
import { getAppConfig } from "@/lib/app-config";
import { getProfileChangeBlockReason, getUserProfileChangeRequestState } from "@/lib/profile-change-requests";
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
  await enforceTermsAcceptanceIfRequired(admin, "/admin/users");

  const { id } = await params;

  const [target, config] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: { email: true },
    }),
    getAppConfig(),
  ]);
  const profileChangeBlockedMessage = target
    ? getProfileChangeBlockReason(target.email)
    : null;
  const profileChangeState = target ? await getUserProfileChangeRequestState(id) : null;

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <AdminSubNav active="reports" />
        <Suspense fallback={<p className="text-muted">Loading user report...</p>}>
          <AdminUserReport
            userId={id}
            profileChangeBlocked={!!profileChangeBlockedMessage}
            profileChangeBlockedMessage={profileChangeBlockedMessage}
            profileChangeOpenRequest={profileChangeState?.openRequest ?? null}
            fiscalYearStartMonth={config.fiscalYearStartMonth}
            fiscalYearEndMonth={config.fiscalYearEndMonth}
          />
        </Suspense>
      </main>
    </>
  );
}
