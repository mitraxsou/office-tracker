"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  AGENT_EXTRACT_FOLDER,
  AGENT_INSTALL_DIR,
  AGENT_TASK_NAME,
  AGENT_ZIP_STEM,
  APP_NAME,
} from "@/lib/agent-branding";
import { APP_VERSION, getCurrentRelease, getVisibleReleaseBullets } from "@/lib/app-version";
import { SectionNavLayout } from "@/components/SectionNavLayout";
import { getHelpNavItems, resolveHelpHash } from "@/components/help-nav";

type HelpGuideProps = {
  isLoggedIn: boolean;
  isAdmin: boolean;
};

export function HelpGuide({ isLoggedIn, isAdmin }: HelpGuideProps) {
  const navItems = useMemo(() => getHelpNavItems(isAdmin), [isAdmin]);

  return (
    <SectionNavLayout
      items={navItems}
      navTitle="Help section"
      defaultActiveId="whats-new"
      resolveHash={resolveHelpHash}
    >
      <div className="space-y-12">
        <section id="whats-new" className="card scroll-mt-header space-y-3 p-6">
          <h2 className="text-lg font-medium">What&apos;s new in v{APP_VERSION}</h2>
          <p className="text-xs text-muted">Released {getCurrentRelease().date}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {getVisibleReleaseBullets(getCurrentRelease(), isAdmin).map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </section>

        <section id="overview" className="card scroll-mt-header space-y-3 p-6">
          <h2 className="text-lg font-medium">What it does</h2>
          <p className="text-sm text-muted">
            {APP_NAME} counts time you spend in the office toward your daily hours target (5 hours in the pilot).
            Visits build from agent heartbeats on approved office Wi-Fi, manual check-in, or admin corrections.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>
              <strong>Today:</strong> desk clock, hours toward target, agent status, and check-in when Wi-Fi fails
            </li>
            <li>
              <strong>Reports:</strong> monthly progress, visit log, and correction requests
            </li>
            <li>
              <strong>Settings:</strong> install or update the agent, account details, and notification prefs
            </li>
            <li>
              Windows agent: task <code>{AGENT_TASK_NAME}</code> wakes every 2 minutes and sends on the
              server interval (5 minutes by default)
            </li>
          </ul>
        </section>

        <section id="legal" className="card scroll-mt-header space-y-3 p-6">
          <h2 className="text-lg font-medium">Terms and privacy</h2>
          <p className="text-sm text-muted">
            By signing in or installing the agent you agree to the{" "}
            <Link href="/terms" className="text-accent hover:underline">
              Terms and Conditions
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-accent hover:underline">
              Privacy Policy
            </Link>
            . After an update, you may need to accept them again before using the dashboard.
          </p>
        </section>

        <section id="account" className="card scroll-mt-header space-y-3 p-6">
          <h2 className="text-lg font-medium">Get an account</h2>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-muted">
            <li>
              <strong className="text-foreground">Sign in with OTP.</strong>{" "}
              {isLoggedIn ? (
                <>You are signed in. Open </>
              ) : (
                <>
                  Go to{" "}
                  <Link href="/login" className="text-accent hover:underline">
                    Sign in
                  </Link>
                  , enter your PwC email, and use the 6-digit code in Microsoft Teams. First sign-in creates
                  your account. Open{" "}
                </>
              )}
              <Link href="/settings#agent" className="text-accent hover:underline">
                Settings
              </Link>{" "}
              (Agent section) to install the agent on each laptop.
            </li>
            <li>
              <strong className="text-foreground">Password sign-in (optional).</strong> Expand{" "}
              <strong>Sign in with password</strong> on the login page after you set a password in Settings, or
              when an admin reset your password.
            </li>
            <li>
              <strong className="text-foreground">Install token.</strong> Your first OTP sign-in creates a laptop
              token. Copy <strong>Copy install command</strong> from Settings → Agent for that laptop.
            </li>
          </ol>
        </section>

        <section id="setup-flow" className="card scroll-mt-header space-y-4 p-6">
          <h2 className="text-lg font-medium">Setup flow</h2>
          <pre className="overflow-x-auto rounded-lg border bg-[var(--background)] p-4 text-xs leading-relaxed text-muted">
{`  ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
  │ Sign in with OTP │ --> │ Accept terms &   │ --> │ Token ready in      │
  │ (auto account)   │     │ set profile      │     │ Settings → Agent    │
  └──────────────────┘     └──────────────────┘     └─────────────────────┘
                                                              │
                                                              v
  ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
  │ Today shows      │ <-- │ Agent syncs      │ <-- │ Download zip, run   │
  │ office hours     │     │ with server      │     │ install in PowerShell│
  └──────────────────┘     └──────────────────┘     └─────────────────────┘`}
          </pre>
          <p className="text-sm text-muted">
            Plan about 5 to 10 minutes per laptop. Re-running install refreshes an existing setup.
          </p>
        </section>

        <section id="install-agent" className="card scroll-mt-header space-y-4 p-6">
          <h2 className="text-lg font-medium">Install the Windows agent</h2>
          <p className="text-sm text-muted">
            Run these steps on each PwC laptop in the pilot. Use <strong>PowerShell</strong>, not Command Prompt.
            No local admin password is required.
          </p>
          <h3 className="text-sm font-medium">Steps 1 to 4: prepare (install and update)</h3>
          <ol className="list-decimal space-y-4 pl-5 text-sm">
            <li>
              <span className="font-medium">Sign in</span> and open{" "}
              <Link href="/settings#install" className="text-accent hover:underline">
                Settings → Agent
              </Link>
              .
            </li>
            <li>
              <span className="font-medium">Download the agent zip</span>
              <p className="mt-1 text-muted">
                Click <strong>Download agent (.zip)</strong>. Save <code>{AGENT_ZIP_STEM}.zip</code> to Downloads
                (often <code>OneDrive - PwC\Downloads</code>).
              </p>
            </li>
            <li>
              <span className="font-medium">Extract the zip</span>
              <p className="mt-1 text-muted">
                Use <strong>Extract All</strong>. Nested folders are common: open until you see{" "}
                <code>install.ps1</code> and <code>update.ps1</code> in the same folder.
              </p>
            </li>
            <li>
              <span className="font-medium">Open PowerShell in that folder</span>
              <p className="mt-1 text-muted">
                Shift + right-click empty space → <strong>Open PowerShell window here</strong>. Run{" "}
                <code>dir</code>; it must list <code>install.ps1</code>. Commands use <code>.\install.ps1</code> and{" "}
                <code>.\update.ps1</code> from this folder only.
              </p>
              <p className="mt-1 text-xs text-muted">
                Example:{" "}
                <code>{`cd "$env:USERPROFILE\\OneDrive - PwC\\Downloads\\${AGENT_ZIP_STEM}\\${AGENT_EXTRACT_FOLDER}"`}</code>
              </p>
            </li>
          </ol>

          <div id="install-first-time" className="scroll-mt-header rounded-lg border border-[var(--border)] p-4">
            <h3 className="text-sm font-medium">Install (first time on this laptop)</h3>
            <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm">
              <li>
                In Settings → Agent, open the laptop card and click <strong>Copy install command</strong> under{" "}
                <strong>Install (first time)</strong>. No token? Ask your pilot admin.
              </li>
              <li>
                Paste into PowerShell in the extract folder and press Enter. Files install to{" "}
                <code>{AGENT_INSTALL_DIR}</code> and register task <code>{AGENT_TASK_NAME}</code>.
              </li>
            </ol>
          </div>

          <div id="update-agent" className="scroll-mt-header rounded-lg border border-[var(--border)] p-4">
            <h3 className="text-sm font-medium">Update (agent already installed)</h3>
            <p className="mt-1 text-sm text-muted">
              Use this when Today shows a stale agent, after sleep issues, or when admins publish a new agent build.
            </p>
            <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm">
              <li>
                Download and extract the latest zip, open PowerShell in that folder, then click{" "}
                <strong>Copy update command</strong> for this laptop in Settings → Agent.
              </li>
              <li>
                Paste and run. The update refreshes scripts and the scheduled task without changing your token.
              </li>
            </ol>
          </div>

          <p className="text-sm text-muted">
            Within 2 to 4 minutes, open{" "}
            <Link href="/dashboard" className="text-accent hover:underline">
              Today
            </Link>
            . Agent status should look healthy, and the laptop serial should appear under registered laptops in
            Settings → Agent.
          </p>
        </section>

        <section id="daily-use" className="card scroll-mt-header space-y-4 p-6">
          <h2 className="text-lg font-medium">Today and Reports</h2>

          <h3 className="text-sm font-medium">Today dashboard</h3>
          <p className="text-sm text-muted">
            <Link href="/dashboard" className="text-accent hover:underline">
              Today
            </Link>{" "}
            is your home view. The <strong>desk clock</strong> shows progress toward today&apos;s hours target. Use
            the gear control to show or hide the clock. Mini stats cover agent status, last sync, in-office now, and
            laptop active time (agent running today, not VPN time).
          </p>
          <p className="text-sm text-muted">
            Scroll the page for monthly office-day progress and the year compliance calendar. Refresh if agent status
            looks old after wake from sleep.
          </p>

          <h3 className="text-sm font-medium">Check in and check out</h3>
          <p className="text-sm text-muted">
            When office Wi-Fi is wrong or missing, tap <strong>Check in</strong> on arrival and{" "}
            <strong>Check out</strong> when you leave. GlobalProtect and other VPN paths do not count as in-office.
            For a past missed day, use <strong>Manual visit</strong>: enter check-in; if you skip check-out, it
            defaults to 5 minutes after check-in (admin approval required).
          </p>

          <h3 className="text-sm font-medium">Laptop notifications</h3>
          <p className="text-sm text-muted">
            When the agent detects office Wi-Fi, Windows shows a toast that monitoring is on. Another toast appears
            when you complete your daily hours target. You can also get in-app and Teams alerts from Settings.
          </p>

          <h3 className="text-sm font-medium">Reports</h3>
          <p className="text-sm text-muted">
            Open <strong>Reports</strong> for monthly charts and calendars. On the <strong>Visits</strong> tab, review
            your log and use <strong>Report issue</strong> on a visit to request an admin correction. Track replies on
            the <strong>Corrections</strong> tab.
          </p>

          <h3 className="text-sm font-medium">HR exemptions on the year calendar</h3>
          <p className="text-sm text-muted">
            With HR approval for a month you could not meet the target, select that month on the year calendar and use{" "}
            <strong>Notify admin</strong>. An admin logs the exemption after verification.
          </p>
        </section>

        <section id="settings" className="card scroll-mt-header space-y-4 p-6">
          <h2 className="text-lg font-medium">Settings</h2>
          <p className="text-sm text-muted">
            Open <Link href="/settings" className="text-accent hover:underline">Settings</Link>. A sticky sidebar
            (or section picker on mobile) jumps to <strong>Agent</strong>, <strong>Account</strong>, and{" "}
            <strong>Notifications</strong>. URLs like <code>#install</code> still open the Agent section and scroll to
            install steps.
          </p>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="font-medium">Agent</dt>
              <dd className="mt-1 text-muted">
                Download the zip, copy install or update commands, and manage registered laptops. Request removal when
                you retire a machine. Copy the uninstall command here when you leave the pilot. Read-only fields show
                your daily hours and monthly office-day targets (admins set org defaults).
              </dd>
            </div>
            <div>
              <dt className="font-medium">Account</dt>
              <dd className="mt-1 text-muted">
                Set timezone so visits and alerts match your work day (pilot default is often Asia/Kolkata). Update
                display name or email via profile change requests when your directory name changes.
              </dd>
            </div>
            <div>
              <dt className="font-medium">Notifications</dt>
              <dd className="mt-1 text-muted">
                Pick usual office days, alert times, and delivery (in-app, Teams, or both). Mark{" "}
                <strong>Out of office</strong> for leave. Alerts can remind you at office start, when you hit your
                daily target, or when the agent needs attention. Recent agent activity on home Wi-Fi is treated as WFH
                and does not trigger a false not-in-office ping.
              </dd>
            </div>
          </dl>
        </section>

        <section id="contact-admin" className="card scroll-mt-header space-y-3 p-6">
          <h2 className="text-lg font-medium">Contact admin</h2>
          <p className="text-sm text-muted">
            Use <strong>Contact admin</strong> in the top navigation for pilot questions, agent problems you cannot fix,
            or product feedback. You can also open it from global search.
          </p>
          <p className="text-sm text-muted">
            For a wrong visit time, prefer <strong>Report issue</strong> on that visit under Reports → Visits so admins
            see the date and duration in context.
          </p>
          {isLoggedIn && (
            <p className="text-sm">
              <Link href="/contact-admin" className="btn-primary inline-block px-4 py-2 text-sm">
                Open Contact admin
              </Link>
            </p>
          )}
        </section>

        <section id="troubleshooting" className="card scroll-mt-header space-y-4 p-6">
          <h2 className="text-lg font-medium">Troubleshooting</h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium">Agent not installed or never connected</p>
              <p className="mt-1 text-muted">
                Finish install steps above. Confirm the install command used the token for this laptop and the production
                app URL from Settings.
              </p>
            </div>
            <div>
              <p className="font-medium">Agent stale or offline</p>
              <p className="mt-1 text-muted">
                Settings → Agent: download the latest zip, extract, open PowerShell in that folder, run the{" "}
                <strong>update command</strong>. Check Task Scheduler for <code>{AGENT_TASK_NAME}</code>. Review{" "}
                <code>%LOCALAPPDATA%\OfficeTracker\logs\heartbeat.log</code> or{" "}
                <Link href="/contact-admin" className="text-accent hover:underline">
                  contact admin
                </Link>
                .
              </p>
            </div>
            <div>
              <p className="font-medium">Wrong or missing Wi-Fi name (SSID)</p>
              <p className="mt-1 text-muted">
                The agent reads your WLAN name via netsh (IT may block Location; you do not need to turn Location on).
                During captive portal sign-in, Windows may briefly show <code>pwcglb.com</code> instead of{" "}
                <code>ExternalConnect</code>. Wait for Wi-Fi to settle or use <strong>Check in</strong> on Today.
              </p>
            </div>
            <div>
              <p className="font-medium">After sleep or laptop wake</p>
              <p className="mt-1 text-muted">
                Heartbeats pause while asleep. After unlock, allow about 5 minutes for the next pulse. Refresh Today if
                status still looks stale.
              </p>
            </div>
            <div>
              <p className="font-medium">Hours stuck in the office</p>
              <p className="mt-1 text-muted">
                Use manual check-in on Today. If it persists, report the visit or contact your pilot admin.
              </p>
            </div>
            <div>
              <p className="font-medium">Open the agent folder on disk</p>
              <p className="mt-1 text-muted">
                Press Win+R, paste <code>%LOCALAPPDATA%\OfficeTracker</code>, Enter. Useful files:{" "}
                <code>office-heartbeat.ps1</code>, <code>run-heartbeat.vbs</code>, <code>logs\heartbeat.log</code>.
              </p>
            </div>
            <div>
              <p className="font-medium">Wrong laptop or regenerated token</p>
              <p className="mt-1 text-muted">
                Each token binds to one laptop serial on first sync. After admin regenerates a token, run the new install
                command on that laptop only.
              </p>
            </div>
          </div>
          {isLoggedIn && (
            <p className="text-sm">
              <Link href="/settings#install" className="btn-primary inline-block px-4 py-2 text-sm">
                Open Agent install steps
              </Link>
            </p>
          )}
        </section>

        <section id="presence" className="card scroll-mt-header space-y-3 p-6">
          <h2 className="text-lg font-medium">How office presence works</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
            <li>Presence is automatic on approved office Wi-Fi SSIDs (admins maintain the list on the server).</li>
            <li>You do not edit SSID names on your laptop.</li>
            <li>Manual check-in and check-out cover gaps when auto-detection fails.</li>
            <li>
              <strong>Not counted:</strong> VPN (for example GlobalProtect), home networks, and gaps longer than about 15
              minutes without a heartbeat (ends the visit).
            </li>
            <li>Default heartbeat interval is about 5 minutes; admins can change it between 2 and 60 minutes.</li>
          </ul>
        </section>

        <section className="card space-y-3 p-6">
          <h2 className="text-lg font-medium text-accent">Security (summary)</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
            <li>Dashboard access uses an httpOnly session cookie. You only see your own visits.</li>
            <li>The agent uses a per-laptop token, not your email password. Tokens are hashed on the server.</li>
            <li>The laptop stores only API URL and token. Wi-Fi rules and targets come from the server.</li>
          </ul>
        </section>

        {isAdmin && (
          <section id="admin" className="card scroll-mt-header space-y-3 p-6">
            <h2 className="text-lg font-medium">Admin notes</h2>
            <p className="text-sm text-muted">
              Full admin SOP:{" "}
              <Link href="/admin/guide" className="text-accent hover:underline">
                Admin guide
              </Link>
              .
            </p>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
              <li>
                Issue tokens from <Link href="/admin" className="text-accent hover:underline">Admin</Link> → Users
                &amp; tokens.
              </li>
              <li>
                Office SSIDs and hours targets:{" "}
                <Link href="/admin/settings" className="text-accent hover:underline">
                  Admin settings
                </Link>
                .
              </li>
              <li>Approve removals, visit corrections, timezone changes, and HR exemptions.</li>
            </ul>
          </section>
        )}
      </div>
    </SectionNavLayout>
  );
}
