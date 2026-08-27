import { AppNav } from "@/components/AppNav";
import Link from "next/link";

export default function HelpPage() {
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">How it works</h1>
          <p className="mt-2 text-muted">Pilot tool: identity, security, setup</p>
        </div>

        <section className="card space-y-3 p-6">
          <h2 className="text-lg font-medium text-accent">Identity</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
            <li>Register with email and password. Each account gets a private <code>userId</code>.</li>
            <li>The dashboard uses an httpOnly session cookie. You only see your own visits and hours.</li>
            <li>
              The Windows agent sends an <strong>agent token</strong>, not your email. Admins issue
              one token per laptop; tokens are bcrypt-hashed on the server.
            </li>
          </ul>
        </section>

        <section className="card space-y-3 p-6">
          <h2 className="text-lg font-medium text-accent">What counts as &quot;in office&quot;</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
            <li>
              <strong>OfficeConnect</strong> and <strong>ExternalConnect</strong> Wi-Fi (admin
              settings, stored on the server)
            </li>
            <li>Manual check-in/out for edge cases</li>
            <li>
              <strong>Not counted:</strong> GlobalProtect/VPN, public IP, or any network outside the
              allowlist
            </li>
          </ul>
        </section>

        <section className="card space-y-3 p-6">
          <h2 className="text-lg font-medium text-accent">Security</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
            <li>Agent tokens stored as bcrypt hashes. Pending install commands are visible in Settings until the laptop registers.</li>
            <li>Heartbeat rate limit: 1 request per 30 seconds per token</li>
            <li>Inputs validated (SSID length, timestamps, no injection characters)</li>
            <li>Session cookies: httpOnly, secure in production, sameSite=lax</li>
            <li>Security headers on all responses</li>
            <li>
              Laptop stores only <code>apiUrl</code> and token. SSIDs and targets come from the
              server.
            </li>
            <li>Passwords and tokens are never logged</li>
          </ul>
        </section>

        <section className="card space-y-3 p-6">
          <h2 className="text-lg font-medium text-accent">Agent install</h2>
          <p className="text-sm text-muted">
            No admin required. Runs as your user account. Full numbered steps are on{" "}
            <Link href="/settings" className="text-accent hover:underline">
              Settings
            </Link>
            : download zip, extract to Downloads, open PowerShell, copy install command, run it,
            then check the dashboard.
          </p>
        </section>
      </main>
    </>
  );
}
