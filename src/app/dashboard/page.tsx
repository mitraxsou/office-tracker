import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getTodaySummary } from "@/lib/heartbeat-service";
import { getUserHoursTarget } from "@/lib/app-config";
import { AppNav } from "@/components/AppNav";
import { ProgressMeter } from "@/components/ProgressMeter";
import { VisitList } from "@/components/VisitList";
import { ManualVisitForm } from "@/components/ManualVisitForm";
import { QuickOfficeToggle } from "@/components/QuickOfficeToggle";
import { AgentSetupBanner } from "@/components/AgentSetupBanner";
import { formatTime } from "@/lib/visits";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const summary = await getTodaySummary(
    user.id,
    user.timezone,
    await getUserHoursTarget(user)
  );
  const agentNeverConnected = !summary.lastHeartbeat;
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
            {summary.dayKey} · Your personal hours (not an admin view)
          </p>
        </div>

        {agentNeverConnected && <AgentSetupBanner />}
        {!agentNeverConnected && ssidMissing && <AgentSetupBanner ssidMissing />}

        <ProgressMeter
          totalHours={summary.totalHours}
          targetHours={summary.hoursTarget}
          metTarget={summary.metTarget}
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
          </p>
        )}

        {summary.lastHeartbeat && (
          <p className="text-xs text-muted">
            Last SSID: {summary.lastHeartbeat.ssid ?? "none"} · VPN (diagnostic only):{" "}
            {summary.lastHeartbeat.vpnGateway ?? "n/a"} — VPN never counts toward hours.
          </p>
        )}

        {!agentNeverConnected && !summary.agentHealthy && (
          <p className="text-sm text-muted">
            Agent hasn&apos;t sent a heartbeat in 8+ minutes. Check Task Scheduler or re-run{" "}
            <Link href="/settings" className="text-accent hover:underline">
              install.ps1
            </Link>
            .
          </p>
        )}

        <QuickOfficeToggle inOfficeNow={summary.inOfficeNow} />

        <section className="card p-6">
          <h2 className="mb-4 text-lg font-medium">Today&apos;s visits</h2>
          <VisitList visits={summary.visits} timezone={user.timezone} />
        </section>

        <ManualVisitForm timezone={user.timezone} />
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
