import Link from "next/link";
import { requireAuthenticatedUser, enforcePasswordChangeIfRequired, enforceTermsAcceptanceIfRequired } from "@/lib/session-guards";
import { getRealCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getTodaySummary, getPulseStats } from "@/lib/heartbeat-service";
import { getUserHoursTarget, getAppConfig, getEffectiveAgentStaleGraceHours } from "@/lib/app-config";
import { getMonthlyProgress, getYearCompliance } from "@/lib/monthly-progress-server";
import {
  getApprovedExemptionsForUser,
  getPendingExemptionMonthKeys,
} from "@/lib/compliance-exemptions";
import { getPendingPriorComplianceMonthKeys } from "@/lib/prior-compliance";
import { isUserOutOfOffice } from "@/lib/out-of-office";
import { AppNav } from "@/components/AppNav";
import { MonthlyProgressMeter } from "@/components/MonthlyProgressMeter";
import { YearComplianceMeter } from "@/components/YearComplianceMeter";
import { DashboardRefreshButton } from "@/components/DashboardRefreshButton";
import { DashboardHeroSummary } from "@/components/dashboard/DashboardHeroSummary";
import { DashboardAlerts } from "@/components/dashboard/DashboardAlerts";
import { DashboardDetailsPanel } from "@/components/dashboard/DashboardDetailsPanel";
import {
  deviceRegistrationReferenceAt,
  getLastOfficeActivityAt,
  latestDeviceLastSeenAt,
  resolveAgentSyncHealth,
} from "@/lib/activity-signal";
import { formatLastHeartbeat } from "@/lib/visits";
import { formatPulseAge } from "@/lib/pulse-age";

export default async function DashboardPage() {
  const user = await requireAuthenticatedUser();
  enforcePasswordChangeIfRequired(user);
  await enforceTermsAcceptanceIfRequired(user, "/dashboard");
  const realUser = await getRealCurrentUser();
  const adminAccess = isAdmin(realUser ?? user);

  const config = await getAppConfig();
  const hoursTarget = await getUserHoursTarget(user);
  const graceHours = await getEffectiveAgentStaleGraceHours(user);
  const summary = await getTodaySummary(
    user.id,
    user.timezone,
    hoursTarget,
    graceHours,
  );
  const approvedExemptions = await getApprovedExemptionsForUser(user.id);
  const pendingExemptionMonthKeys = await getPendingExemptionMonthKeys(user.id);
  const pendingPriorComplianceMonthKeys = await getPendingPriorComplianceMonthKeys(user.id);
  const monthlyProgress = await getMonthlyProgress(
    user.id,
    user.timezone,
    hoursTarget,
    config.monthlyDaysTarget,
    new Date(),
    undefined,
    approvedExemptions,
  );
  const yearCompliance = await getYearCompliance(
    user.id,
    user.timezone,
    hoursTarget,
    config.monthlyDaysTarget,
    new Date(),
    approvedExemptions,
    pendingExemptionMonthKeys,
    config.pilotStartMonthKey,
    pendingPriorComplianceMonthKeys,
  );
  const pulse = await getPulseStats(user.id, graceHours);
  const lastOfficeActivityAt = await getLastOfficeActivityAt(user.id);
  const isOutToday = await isUserOutOfOffice(user.id, summary.dayKey);
  const lastHeartbeat = summary.lastHeartbeat;
  const lastSyncedAt = latestDeviceLastSeenAt(user.agentDevices);
  const deviceReferenceAt = deviceRegistrationReferenceAt(user.agentDevices);
  const syncHealth = resolveAgentSyncHealth({
    lastSyncedAt,
    graceHours,
    pulseAgentHealthy: pulse.agentHealthy,
    pulsesLast24h: pulse.pulsesLast24h,
    expectedPulsesPerDay: pulse.expectedPulsesPerDay,
    deviceReferenceAt,
  });
  const agentNeverConnected = user.agentDevices.length === 0 || !lastSyncedAt;
  const agentStale =
    !isOutToday &&
    user.agentDevices.length > 0 &&
    syncHealth.showStaleWarning;
  const agentLowPulses =
    !isOutToday &&
    user.agentDevices.length > 0 &&
    pulse.agentHealthy &&
    syncHealth.lowActivity;
  const minutesSinceLastSync = syncHealth.minutesSinceLastSync;
  const ssidMissing =
    !!summary.lastHeartbeat && !summary.lastHeartbeat.ssid && summary.lastHeartbeat.inOffice === false;
  const openVisit = summary.visits.find((v) => v.endAt === null);
  const firstCheckIn =
    summary.visits.length > 0
      ? summary.visits.reduce((earliest, visit) =>
          visit.startAt < earliest.startAt ? visit : earliest,
        ).startAt
      : null;
  const agentStatusValue = agentNeverConnected
    ? "Not connected"
    : syncHealth.healthy
      ? "Healthy"
      : "Stale / offline";
  const agentStatusTone: StatusTone = agentNeverConnected
    ? "neutral"
    : syncHealth.healthy
      ? "success"
      : "warning";
  const lastSyncedLabel = lastSyncedAt
    ? formatPulseAge({
        minutes: minutesSinceLastSync,
        lastPulseAt: lastSyncedAt,
        timezone: user.timezone,
      })
    : "None";
  const lastSyncedTone: StatusTone = !lastSyncedAt
    ? "muted"
    : syncHealth.showStaleWarning
      ? "warning"
      : "neutral";
  const lastOfficeActivityLabel = lastOfficeActivityAt
    ? formatLastHeartbeat(lastOfficeActivityAt, summary.dayKey, user.timezone)
    : "None";
  const lastOfficeActivityTone: StatusTone = lastOfficeActivityAt ? "success" : "muted";

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">Today</h1>
            <p className="text-xs text-muted sm:text-sm">
              {summary.dayKey} · Your hours only
            </p>
          </div>
          <DashboardRefreshButton />
        </div>

        <DashboardAlerts
          agentNeverConnected={agentNeverConnected}
          ssidMissing={ssidMissing}
          agentStale={agentStale}
          agentLowPulses={agentLowPulses}
          adminAccess={adminAccess}
          minutesSinceLastSync={minutesSinceLastSync}
          lastSyncedAt={lastSyncedAt}
          timezone={user.timezone}
        />

        <DashboardHeroSummary
          totalHours={summary.totalHours}
          targetHours={summary.hoursTarget}
          metTarget={summary.metTarget}
          laptopActiveHours={summary.laptopActiveHours}
          firstCheckIn={firstCheckIn}
          dayKey={summary.dayKey}
          timezone={user.timezone}
          inOfficeNow={summary.inOfficeNow}
          agentStatusValue={agentStatusValue}
          agentStatusTone={agentStatusTone}
          lastSyncedLabel={lastSyncedLabel}
          lastSyncedTone={lastSyncedTone}
          lastOfficeActivityLabel={lastOfficeActivityLabel}
          lastOfficeActivityTone={lastOfficeActivityTone}
          openVisitStartAt={openVisit?.startAt ?? null}
          openVisitSsid={openVisit?.ssid ?? null}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <MonthlyProgressMeter
            qualifyingDays={monthlyProgress.qualifyingDays}
            monthlyDaysTarget={monthlyProgress.monthlyDaysTarget}
            metTarget={monthlyProgress.metTarget}
            monthKey={monthlyProgress.monthKey}
            totalHours={monthlyProgress.totalHours}
            compact
          />
          <YearComplianceMeter
            compliance={yearCompliance}
            timezone={user.timezone}
            hoursTarget={hoursTarget}
            compact
          />
        </div>

        {adminAccess && user.agentDevices.length > 0 && (
          <p className="text-xs text-muted">
            Registered laptops:{" "}
            {user.agentDevices.map((d) => (
              <code key={d.id} className="mr-2 text-accent">
                {d.serialNumber}
              </code>
            ))}
          </p>
        )}

        {adminAccess && lastHeartbeat && (
          <p className="text-xs text-muted">
            Last SSID: {lastHeartbeat.ssid ?? "none"} · VPN (diagnostic only):{" "}
            {lastHeartbeat.vpnGateway ?? "n/a"}. VPN does not count toward hours.
          </p>
        )}

        {adminAccess && !agentNeverConnected && !syncHealth.healthy && !agentStale && (
          <p className="text-xs text-muted">
            Agent has not synced recently. Check Task Scheduler or re-run{" "}
            <Link href="/settings#install" className="text-accent hover:underline">
              install.ps1
            </Link>
            .
          </p>
        )}

        <DashboardDetailsPanel
          visits={summary.visits}
          timezone={user.timezone}
          visitCount={summary.visits.length}
          showPulses={adminAccess && !agentNeverConnected && pulse.recentPulses.length > 0}
          pulses={pulse.recentPulses}
          retentionDays={config.heartbeatRetentionDays}
        />

        <p className="text-xs text-muted">
          Manage Teams and email alerts in{" "}
          <Link href="/settings" className="text-accent hover:underline">
            Settings
          </Link>
          .
        </p>
      </main>
    </>
  );
}

type StatusTone = "success" | "warning" | "neutral" | "muted";
