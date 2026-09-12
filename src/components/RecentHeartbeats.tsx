type Pulse = {
  recordedAt: string;
  inOffice: boolean;
  ssid: string | null;
};

export function RecentHeartbeats({
  pulses,
  timezone,
  retentionDays,
  embedded = false,
}: {
  pulses: Pulse[];
  timezone: string;
  retentionDays: number;
  embedded?: boolean;
}) {
  const wrapperClass = embedded ? "" : "card p-6";

  if (pulses.length === 0) {
    return (
      <section className={wrapperClass}>
        {!embedded && <h2 className="mb-2 text-lg font-medium">Recent agent activity</h2>}
        <p className="text-sm text-muted">No agent activity recorded yet.</p>
      </section>
    );
  }

  return (
    <section className={wrapperClass}>
      {!embedded && <h2 className="mb-1 text-lg font-medium">Recent agent activity</h2>}
      <p className={`text-sm text-muted ${embedded ? "mb-2" : "mb-4"}`}>
        Wi-Fi and activity events from your laptop agent (up to {retentionDays} day
        {retentionDays === 1 ? "" : "s"} kept on the server). This is separate from
        &quot;Office session since&quot;, which tracks your current visit window.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-muted">
              <th className="py-2 pr-3">Time</th>
              <th className="py-2 pr-3">In office</th>
              <th className="py-2">SSID</th>
            </tr>
          </thead>
          <tbody>
            {pulses.map((p) => (
              <tr key={p.recordedAt} className="border-b border-[var(--border)]">
                <td className="py-2 pr-3 text-xs">
                  {new Date(p.recordedAt).toLocaleString("en-IN", { timeZone: timezone })}
                </td>
                <td className="py-2 pr-3">{p.inOffice ? "Yes" : "No"}</td>
                <td className="py-2 font-mono text-xs">{p.ssid ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
