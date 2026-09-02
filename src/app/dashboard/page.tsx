import Link from "next/link";
import { requireAuthenticatedUser, enforcePasswordChangeIfRequired } from "@/lib/session-guards";
import { getTodaySummary, getPulseStats } from "@/lib/heartbeat-service";
import { getUserHoursTarget, getAppConfig, getEffectiveAgentStaleGraceHours } from "@/lib/app-config";
import { getMonthlyProgress } from "@/lib/monthly-progress";
import { isUserOutOfOffice } from "@/lib/out-of-office";
import { AppNav } from "@/components/AppNav";
import { ProgressMeter } from "@/components/ProgressMeter";
import { MonthlyProgressMeter } from "@/components/MonthlyProgressMeter";
import { VisitList } from "@/components/VisitList";
import { ManualVisitForm } from "@/components/ManualVisitForm";
import { QuickOfficeToggle } from "@/components/QuickOfficeToggle";
import { AgentSetupBanner } from "@/components/AgentSetupBanner";
import { AgentHealthBanner } from "@/components/AgentHealthBanner";
import { RecentHeartbeats } from "@/components/RecentHeartbeats";
import { formatTime } from "@/lib/visits";

export default async function DashboardPage() {
  const user = await requireAuthenticatedUser();
  enforcePasswordChangeIfRequired(user);

  const config = await getAppConfig();
  const hoursTarget = await getUserHoursTarget(user);
  const graceHours = await getEffectiveAgentStaleGraceHours(user);
  const summary = await getTodaySummary(
    user.id,
    user.timezone,
    hoursTarget,
    graceHours,
  );
  const monthlyProgress = await getMonthlyProgress(
    user.id,
    user.timezone,
    hoursTarget,
    config.monthlyDaysTarget,
  );
  const pulse = await getPulseStats(user.id, graceHours);
  const isOutToday = await isUserOutOfOffice(user.id, summary.dayKey);
  const agentNeverConnected = !summary.lastHeartbeat && user.agentDevices.length === 0;
  const agentStale = !isOutToday && !!summary.lastHeartbeat && !summary.agentHealthy;
  const agentLowPulses =
    !isOutToday &&
    user.agentDevices.length > 0 &&
    !!pulse.lastHeartbeat &&
    pulse.agentHealthy &&
    pulse.pulsesLast24h < 30;
  const ssidMissing =
    !!summary.lastHeartbeat && !summary.lastHeartbeat.ssid && summary.lastHeartbeat.inOffice === false;
  const openVisit = summary.visits.find((v) => v.endAt === null);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Today</h1>
          <p className="text-sm text-muted">
            {summary.dayKey} · Your hours only
          </p>
        </div>

        {agentNeverConnected && <AgentSetupBanner />}
        {!agentNeverConnected && ssidMissing && <AgentSetupBanner ssidMissing />}
        {agentStale && (
          <AgentHealthBanner
            variant="stale"
            minutesSinceLastPulse={pulse.minutesSinceLastPulse}
          />
        )}
        {!agentStale && agentLowPulses && <AgentHealthBanner variant="low_pulses" />}

        <ProgressMeter
          totalHours={summary.totalHours}
          targetHours={summary.hoursTarget}
          metTarget={summary.metTarget}
        />

        <MonthlyProgressMeter
          qualifyingDays={monthlyProgress.qualifyingDays}
          monthlyDaysTarget={monthlyProgress.monthlyDaysTarget}
          metTarget={monthlyProgress.metTarget}
          monthKey={monthlyProgress.monthKey}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <StatusCard
            label="In office now"
            value={summary.inOfficeNow ? "Yes" : "No"}
            highlight={summary.inOfficeNow}
          />
          <StatusCard
            label="Agent status"
            value={
              agentNeverConnected
                ? "Not connected"
                : summary.agentHealthy
                  ? "Healthy"
                  : "Stale / offline"
            }
            highlight={summary.agentHealthy}
          />
          <StatusCard
            label="Last heartbeat"
            value={
              summary.lastHeartbeat
                ? new Date(summary.lastHeartbeat.recordedAt).toLocaleTimeString("en-IN", {
                    timeZone: user.timezone,
                  })
                : "Never"
            }
          />
        </div>

        {user.agentDevices.length > 0 && (
          <p className="text-sm text-muted">
            Registered laptops:{" "}
            {user.agentDevices.map((d) => (
              <code key={d.id} className="mr-2 text-accent">
                {d.serialNumber}
              </code>
            ))}
          </p>
        )}

        {summary.inOfficeNow && openVisit && (
          <p className="text-sm text-muted">
            Office session since{" "}
            <strong className="text-accent">
              {formatTime(openVisit.startAt, user.timezone)}
            </strong>
            {openVisit.ssid ? ` on ${openVisit.ssid}` : ""}
            . This is when your current visit started (not your first heartbeat ever).
          </p>
        )}

        {summary.lastHeartbeat && (
          <p className="text-xs text-muted">
            Last SSID: {summary.lastHeartbeat.ssid ?? "none"} · VPN (diagnostic only):{" "}
            {summary.lastHeartbeat.vpnGateway ?? "n/a"}. VPN does not count toward hours.
          </p>
        )}

        {!agentNeverConnected && !summary.agentHealthy && !agentStale && (
          <p className="text-sm text-muted">
            Agent has not sent a heartbeat recently. Check Task Scheduler or re-run{" "}
            <Link href="/settings#install" className="text-accent hover:underline">
              install.ps1
            </Link>
            .
          </p>
        )}

        <QuickOfficeToggle inOfficeNow={summary.inOfficeNow} />

        {!agentNeverConnected && pulse.recentPulses.length > 0 && (
          <RecentHeartbeats
            pulses={pulse.recentPulses}
            timezone={user.timezone}
            retentionDays={config.heartbeatRetentionDays}
          />
        )}

        <p className="text-xs text-muted">
          Manage Teams and email alerts in{" "}
          <Link href="/settings" className="text-accent hover:underline">
            Settings
          </Link>
          .
        </p>

        <section className="card p-6">
          <h2 className="mb-4 text-lg font-medium">Today&apos;s visits</h2>
          <VisitList visits={summary.visits} timezone={user.timezone} />
        </section>

        <ManualVisitForm timezone={user.timezone} officeSsids={config.officeSsids} />
      </main>
    </>
  );
}

function StatusCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${highlight ? "text-accent" : ""}`}>{value}</p>
    </div>
  );
}
