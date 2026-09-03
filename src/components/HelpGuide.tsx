import Link from "next/link";
import {
  AGENT_EXTRACT_FOLDER,
  AGENT_INSTALL_DIR,
  AGENT_PRODUCT_NAME,
  AGENT_TASK_NAME,
} from "@/lib/agent-branding";

type HelpGuideProps = {
  isLoggedIn: boolean;
  isAdmin: boolean;
};

function SectionAnchor({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-6 text-lg font-medium text-accent">
      {children}
    </h2>
  );
}

export function HelpGuide({ isLoggedIn, isAdmin }: HelpGuideProps) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">How to use PwC Office Pulse</h1>
        <p className="mt-2 text-muted">
          Step-by-step guide for the office presence pilot. You can read this before signing in.
        </p>
        {!isLoggedIn && (
          <p className="mt-3 text-sm">
            <Link href="/login" className="text-accent hover:underline">
              Sign in
            </Link>
            {" · "}
            <Link href="/register" className="text-accent hover:underline">
              Register
            </Link>
          </p>
        )}
      </div>

      <nav className="card p-4 text-sm">
        <p className="mb-2 font-medium">On this page</p>
        <ul className="columns-1 gap-x-8 space-y-1 text-muted sm:columns-2">
          <li>
            <a href="#overview" className="text-accent hover:underline">
              What it does
            </a>
          </li>
          <li>
            <a href="#account" className="text-accent hover:underline">
              Get an account
            </a>
          </li>
          <li>
            <a href="#setup-flow" className="text-accent hover:underline">
              Setup flow
            </a>
          </li>
          <li>
            <a href="#install-agent" className="text-accent hover:underline">
              Install the agent
            </a>
          </li>
          <li>
            <a href="#install-folder" className="text-accent hover:underline">
              Open the install folder
            </a>
          </li>
          <li>
            <a href="#daily-use" className="text-accent hover:underline">
              Daily use
            </a>
          </li>
          <li>
            <a href="#settings" className="text-accent hover:underline">
              Settings
            </a>
          </li>
          <li>
            <a href="#troubleshooting" className="text-accent hover:underline">
              Troubleshooting
            </a>
          </li>
          <li>
            <a href="#presence" className="text-accent hover:underline">
              How presence works
            </a>
          </li>
          {isAdmin && (
            <li>
              <a href="#admin" className="text-accent hover:underline">
                Admin notes
              </a>
            </li>
          )}
        </ul>
      </nav>

      <section className="card space-y-3 p-6">
        <SectionAnchor id="overview">What it does</SectionAnchor>
        <p className="text-sm text-muted">
          PwC Office Pulse tracks whether you spend at least <strong>5 hours per day in the office</strong>{" "}
          during the pilot. A small Windows agent on your PwC laptop reports presence automatically while
          you are connected to office Wi-Fi. You can also check in or out manually if auto-detection fails.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Web dashboard: today&apos;s hours, visit history, and progress toward the daily target</li>
          <li>Windows agent: runs in the background every 2 minutes (no admin rights required)</li>
          <li>One install token per laptop; admins issue tokens and approve laptop removals</li>
        </ul>
      </section>

      <section className="card space-y-3 p-6">
        <SectionAnchor id="account">Get an account</SectionAnchor>
        <ol className="list-decimal space-y-3 pl-5 text-sm text-muted">
          <li>
            <strong className="text-foreground">Contact your pilot admin</strong> to be added to Office
            Pulse. Ask them to create your account or confirm that self-registration is enabled for the
            pilot.
          </li>
          <li>
            <strong className="text-foreground">Register or sign in.</strong>{" "}
            {isLoggedIn ? (
              <>You are signed in. Open </>
            ) : (
              <>
                Go to{" "}
                <Link href="/register" className="text-accent hover:underline">
                  Register
                </Link>{" "}
                or{" "}
                <Link href="/login" className="text-accent hover:underline">
                  Sign in
                </Link>
                . If registration is disabled, your admin must create the account for you. Open{" "}
              </>
            )}
            <Link href="/settings#install" className="text-accent hover:underline">
              Settings
            </Link>{" "}
            after your first login.
          </li>
          <li>
            <strong className="text-foreground">Ask admin for an install token</strong> (one per laptop).
            Tokens appear under <strong>Install or reinstall {AGENT_PRODUCT_NAME}</strong> in Settings.
          </li>
        </ol>
        <p className="text-xs text-muted">
          Your admin manages pilot access, install tokens, and compliance reports. There is no shared
          support inbox in the app; use your team&apos;s usual admin contact for the pilot.
        </p>
      </section>

      <section className="card space-y-4 p-6">
        <SectionAnchor id="setup-flow">Setup flow</SectionAnchor>
        <pre className="overflow-x-auto rounded-lg border bg-[var(--background)] p-4 text-xs leading-relaxed text-muted">
{`  ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
  │ Contact admin    │ --> │ Sign in /        │ --> │ Admin issues        │
  │ for account      │     │ register         │     │ laptop install token│
  └──────────────────┘     └──────────────────┘     └─────────────────────┘
                                                              │
                                                              v
  ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
  │ Dashboard shows  │ <-- │ Agent sends      │ <-- │ Download zip, run   │
  │ office hours     │     │ heartbeats       │     │ install in PowerShell│
  └──────────────────┘     └──────────────────┘     └─────────────────────┘`}
        </pre>
        <p className="text-sm text-muted">
          Total setup time is usually 5 to 10 minutes per laptop. Re-running install is safe; it refreshes
          an existing install.
        </p>
      </section>

      <section className="card space-y-4 p-6">
        <SectionAnchor id="install-agent">Install the Windows agent</SectionAnchor>
        <p className="text-sm text-muted">
          Do this on each PwC laptop you use for the pilot. Use <strong>PowerShell</strong>, not Command
          Prompt. No IT admin password is required.
        </p>
        <ol className="list-decimal space-y-4 pl-5 text-sm">
          <li>
            <span className="font-medium">Sign in</span> and open{" "}
            <Link href="/settings#install" className="text-accent hover:underline">
              Settings
            </Link>
            .
          </li>
          <li>
            <span className="font-medium">Download the agent zip</span>
            <p className="mt-1 text-muted">
              Click <strong>Download agent (.zip)</strong> and save <code>PwCOfficePulse-agent.zip</code> to
              your Downloads folder.
            </p>
          </li>
          <li>
            <span className="font-medium">Extract the zip</span>
            <p className="mt-1 text-muted">
              Right-click the zip, choose <strong>Extract All</strong>, and extract to{" "}
              <strong>Downloads</strong>. Windows creates <code>{AGENT_EXTRACT_FOLDER}</code> with{" "}
              <code>install.ps1</code> inside.
            </p>
          </li>
          <li>
            <span className="font-medium">Open PowerShell in that folder</span>
            <p className="mt-1 text-muted">
              In Downloads, open the <code>{AGENT_EXTRACT_FOLDER}</code> folder. Shift + right-click empty
              space and choose <strong>Open PowerShell window here</strong> (or Terminal). You should see{" "}
              <code>install.ps1</code> in that window.
            </p>
            <p className="mt-1 text-xs text-muted">
              Or run:{" "}
              <code>{`cd $env:USERPROFILE\\Downloads\\${AGENT_EXTRACT_FOLDER}`}</code>
            </p>
          </li>
          <li>
            <span className="font-medium">Copy the install command</span>
            <p className="mt-1 text-muted">
              In Settings, under <strong>Install or reinstall {AGENT_PRODUCT_NAME}</strong>, click{" "}
              <strong>Copy install command</strong> for the token that matches this laptop. If you have no
              tokens, ask your admin to issue one from Admin → Users &amp; tokens.
            </p>
          </li>
          <li>
            <span className="font-medium">Paste and run in PowerShell</span>
            <p className="mt-1 text-muted">
              Right-click in the PowerShell window (or press Ctrl+V), then press Enter. The agent installs
              to <code>{AGENT_INSTALL_DIR}</code> and registers scheduled task{" "}
              <code>{AGENT_TASK_NAME}</code>.
            </p>
          </li>
          <li>
            <span className="font-medium">Confirm on the dashboard</span>
            <p className="mt-1 text-muted">
              Within 2 to 4 minutes, open{" "}
              <Link href="/dashboard" className="text-accent hover:underline">
                Today
              </Link>
              . <strong>Agent status</strong> should show healthy, and your laptop serial should appear
              under Registered laptops in Settings.
            </p>
          </li>
        </ol>
      </section>

      <section className="card space-y-4 p-6">
        <SectionAnchor id="install-folder">Open the install folder in Windows Explorer</SectionAnchor>
        <p className="text-sm text-muted">
          The agent files live at <code>{AGENT_INSTALL_DIR}</code> (your user AppData folder, not Program
          Files).
        </p>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium">Option A: Run dialog</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted">
              <li>Press <kbd className="rounded border px-1">Win</kbd> + <kbd className="rounded border px-1">R</kbd></li>
              <li>
                Type or paste: <code>%LOCALAPPDATA%\OfficeTracker</code>
              </li>
              <li>Press Enter. File Explorer opens the folder.</li>
            </ol>
          </div>
          <div>
            <p className="font-medium">Option B: File Explorer address bar</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted">
              <li>Open File Explorer</li>
              <li>Click the address bar at the top (or press Alt+D)</li>
              <li>
                Paste <code>%LOCALAPPDATA%\OfficeTracker</code> and press Enter
              </li>
            </ol>
          </div>
          <div>
            <p className="font-medium">Copy a path from the address bar</p>
            <p className="mt-1 text-muted">
              Click the address bar once to select the full path, then press Ctrl+C. You can paste it into
              email, chat, or another app with Ctrl+V.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted">
          Useful files: <code>office-heartbeat.ps1</code>, <code>run-heartbeat.vbs</code>, and{" "}
          <code>logs\heartbeat.log</code> for troubleshooting.
        </p>
      </section>

      <section className="card space-y-3 p-6">
        <SectionAnchor id="daily-use">Daily use</SectionAnchor>
        <h3 className="text-sm font-medium">Today dashboard</h3>
        <p className="text-sm text-muted">
          Open <strong>Today</strong> to see progress toward your daily target, whether you are in the office
          now, and today&apos;s visits. The agent updates this automatically when you are on office Wi-Fi.
        </p>
        <h3 className="text-sm font-medium">Manual check-in and check-out</h3>
        <p className="text-sm text-muted">
          If auto-detection fails (for example, Wi-Fi issues), use <strong>Check in</strong> when you arrive
          and <strong>Check out</strong> when you leave on the Today page. VPN does not count as in-office.
        </p>
        <h3 className="text-sm font-medium">History and reports</h3>
        <p className="text-sm text-muted">
          <strong>History</strong> lists past visits. <strong>Reports</strong> shows weekly summaries for
          your own data.
        </p>
      </section>

      <section className="card space-y-4 p-6">
        <SectionAnchor id="settings">Settings</SectionAnchor>
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="font-medium">Timezone</dt>
            <dd className="mt-1 text-muted">
              Set your timezone so today&apos;s hours, visit times, and alert schedule match your work day.
              Default for the pilot is often Asia/Kolkata.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Office schedule and alerts</dt>
            <dd className="mt-1 text-muted">
              Choose your usual office days (Wednesday and Friday by default), delivery channels,
              and alert types. Office Pulse can tell you when office hours start, when you meet your
              daily target, or when the agent needs attention. A recent pulse on home or other
              non-office Wi-Fi is treated as working from home and does not trigger a not-in-office
              reminder.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Out of office</dt>
            <dd className="mt-1 text-muted">
              Mark days when you are away (leave, WFH without laptop, etc.). No reminders are sent for those
              days. You can also mark out from a one-click link in alert emails. Open Settings → Out of
              office, or use the link in your alert.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Install or reinstall agent</dt>
            <dd className="mt-1 text-muted">
              At the top of Settings, copy install commands to set up or reinstall the agent without
              asking admin again. Each token binds to one laptop serial on first heartbeat.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Registered laptops and removal requests</dt>
            <dd className="mt-1 text-muted">
              Each laptop registers on first heartbeat. To remove an old or replaced laptop, click{" "}
              <strong>Request removal</strong> in Settings. An admin must approve before the device is
              removed (this prevents accidental de-registration).
            </dd>
          </div>
          <div>
            <dt className="font-medium">Uninstall</dt>
            <dd className="mt-1 text-muted">
              Copy the uninstall command from Settings, run it in PowerShell from the extracted agent
              folder, or from the install folder. This removes the scheduled task and local files.
            </dd>
          </div>
        </dl>
      </section>

      <section className="card space-y-4 p-6">
        <SectionAnchor id="troubleshooting">Troubleshooting</SectionAnchor>
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium">Agent not installed or never connected</p>
            <p className="mt-1 text-muted">
              Complete the install steps above. Confirm you used the correct install token and production URL.
            </p>
          </div>
          <div>
            <p className="font-medium">Agent stale or offline</p>
            <p className="mt-1 text-muted">
              Open Settings and go to Install or reinstall. Download and extract the latest agent
              zip, copy the install command, and run it in PowerShell. Check Task Scheduler for task{" "}
              <code>{AGENT_TASK_NAME}</code>. If it still does not pulse, review{" "}
              <code>%LOCALAPPDATA%\OfficeTracker\logs\heartbeat.log</code> or contact your pilot admin.
            </p>
          </div>
          <div>
            <p className="font-medium">After sleep or laptop wake</p>
            <p className="mt-1 text-muted">
              Heartbeats pause while the laptop sleeps. After wake or unlock, the agent should recover within about
              2 minutes (unlock and power-resume triggers run the heartbeat sooner). Wi-Fi may take a few seconds to
              reconnect; the agent retries SSID detection automatically. Refresh the Today dashboard if agent status
              still looks stale after a minute.
            </p>
          </div>
          <div>
            <p className="font-medium">Low pulses but agent shows connected</p>
            <p className="mt-1 text-muted">
              The scheduled task may not be running reliably. Re-run install, then confirm the{" "}
              <code>{AGENT_TASK_NAME}</code> task exists and last run time is recent.
            </p>
          </div>
          <div>
            <p className="font-medium">Wi-Fi name differs from Windows tray</p>
            <p className="mt-1 text-muted">
              The agent reports your laptop&apos;s Wi-Fi network name (SSID). During captive portal sign-in,
              Windows may briefly show a domain name such as <code>pwcglb.com</code> instead of{" "}
              <code>ExternalConnect</code>. The agent prefers the actual WLAN name from netsh. If pulses show
              the wrong network or &quot;Identifying...&quot;, wait a minute for Wi-Fi to settle, or use{" "}
              <strong>Check in</strong> on the Today page.
            </p>
          </div>
          <div>
            <p className="font-medium">Hours not updating in the office</p>
            <p className="mt-1 text-muted">
              Use manual check-in on the Today page. If the problem persists, contact your pilot admin.
            </p>
          </div>
          <div>
            <p className="font-medium">Wrong laptop or token regenerated</p>
            <p className="mt-1 text-muted">
              Each token is tied to one laptop serial after first use. Use the token issued for that machine.
              If admin regenerated your token, re-run the new install command on the affected laptop.
            </p>
          </div>
        </div>
        {isLoggedIn && (
          <p className="text-sm">
            <Link href="/settings#install" className="btn-primary inline-block px-4 py-2 text-sm">
              Open install steps
            </Link>
          </p>
        )}
      </section>

      <section className="card space-y-3 p-6">
        <SectionAnchor id="presence">How office presence works</SectionAnchor>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
          <li>
            The app detects when you are in the office <strong>automatically</strong> via office Wi-Fi. You
            do not configure Wi-Fi names on your laptop.
          </li>
          <li>Office network rules are set by admins on the server only.</li>
          <li>Manual check-in/out covers edge cases when auto-detection fails.</li>
          <li>
            <strong>Not counted:</strong> VPN (for example GlobalProtect), home networks, and time away from
            the laptop without a manual check-out.
          </li>
          <li>
            The agent sends a heartbeat about every 2 minutes. A gap longer than about 8 minutes ends the
            current visit.
          </li>
        </ul>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-medium text-accent">Security (summary)</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
          <li>Your dashboard uses an httpOnly session cookie. You only see your own visits and hours.</li>
          <li>
            The Windows agent uses a per-laptop token, not your email password. Tokens are stored as hashes
            on the server.
          </li>
          <li>
            The laptop stores only the API URL and token. Office detection rules and daily targets come from
            the server.
          </li>
          <li>Passwords and tokens are never logged.</li>
        </ul>
      </section>

      {isAdmin && (
        <section id="admin" className="card space-y-3 p-6">
          <h2 className="text-lg font-medium text-accent">Admin notes</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
            <li>
              Issue install tokens from <Link href="/admin" className="text-accent hover:underline">Admin</Link>{" "}
              → Users &amp; tokens.
            </li>
            <li>
              Configure office Wi-Fi SSIDs and daily hours target in{" "}
              <Link href="/admin/settings" className="text-accent hover:underline">
                Admin settings
              </Link>
              . Normal users cannot see or edit SSID names.
            </li>
            <li>Approve laptop removal requests from Admin → Corrections.</li>
            <li>Visit corrections and compliance reports are available under Admin.</li>
          </ul>
        </section>
      )}
    </div>
  );
}
