import { AppNav } from "@/components/AppNav";
import Link from "next/link";

export default function HelpPage() {
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">How it works</h1>
          <p className="mt-2 text-muted">Office Tracker pilot — identity, security, and configuration</p>
        </div>

        <section className="card space-y-3 p-6">
          <h2 className="text-lg font-medium text-accent">How identity works</h2>
          <p className="text-sm leading-relaxed text-muted">
            Each colleague registers with a unique email and password, which creates a private{" "}
            <code>userId</code> in the database. The web dashboard uses an httpOnly session cookie tied
            to that user — you only ever see your own visits and hours. The Windows agent never sends
            your email; it authenticates with a unique <strong>agent token</strong> (bcrypt-hashed on
            the server). One token per user. Heartbeats and config requests are mapped to exactly one
            account via that token.
          </p>
        </section>

        <section className="card space-y-3 p-6">
          <h2 className="text-lg font-medium text-accent">What counts as &quot;in office&quot;</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
            <li>
              <strong>OfficeConnect</strong> and <strong>ExternalConnect</strong> Wi-Fi SSIDs (configured
              in Settings, stored on Vercel)
            </li>
            <li>Manual check-in/out for edge cases</li>
            <li>
              <strong>Not counted:</strong> GlobalProtect/VPN (always on at home and office), public IP,
              or any network not in your allowlist
            </li>
          </ul>
        </section>

        <section className="card space-y-3 p-6">
          <h2 className="text-lg font-medium text-accent">Security model</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
            <li>Agent tokens stored as bcrypt hashes — plain token never persisted after display</li>
            <li>Heartbeat rate-limited (max 1 request per 30 seconds per token)</li>
            <li>All inputs validated (SSID length, timestamps, no injection characters)</li>
            <li>Secure session cookies (httpOnly, secure in production, sameSite=lax)</li>
            <li>Security headers on all responses (X-Frame-Options, CSP, etc.)</li>
            <li>Laptop stores only <code>apiUrl</code> + token — SSIDs and targets fetched from server</li>
            <li>Passwords and tokens are never logged</li>
          </ul>
        </section>

        <section className="card space-y-3 p-6">
          <h2 className="text-lg font-medium text-accent">Agent install</h2>
          <p className="text-sm text-muted">
            <strong>Admin required: No.</strong> Install runs as your user account. See{" "}
            <Link href="/settings" className="text-accent hover:underline">
              Settings
            </Link>{" "}
            for install commands.
          </p>
        </section>
      </main>
    </>
  );
}
