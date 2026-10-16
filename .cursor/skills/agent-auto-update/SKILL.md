---
name: agent-auto-update
description: >-
  Hard gate for Windows agent auto-update safety in OfficeTracker. Use whenever
  editing agent/, agent download/update APIs, Publish-AgentScriptTxt,
  run-heartbeat.vbs, setup.ps1, update.ps1, office-heartbeat.ps1, version.txt,
  forceAgentUpdate, agent zip publish, or any change that ships to laptops.
  Enforces Soumitra-only soak (BUG-018): never push/publish agent updates to
  production/fleet until explicit rollout approval. Also prevents IEX .txt
  parse breakage (BUG-017) that stops the scheduled task runner for the fleet.
---

# Agent auto-update must never break

A bad agent ship can silence every laptop: the task still "runs" (wscript exits 0) while `office-heartbeat.txt` fails to parse, so no sync, no soft update, no recovery without a manual Settings update.

**Incident (parse):** Agent 1.5.23 wrote an em dash into the last-run summary. `Publish-AgentScriptTxt` read the `.ps1` with the system ANSI code page, mojibaked `office-heartbeat.txt`, and `Invoke-Expression` died every 2 minutes. See **BUG-017**.

**Policy (rollout):** No production / fleet agent publish until Soumitra laptop soak confirms autoupdate still works. See **BUG-018**.

## BUG-018 - Soumitra-only / no fleet push (default)

Until the user **explicitly** approves fleet rollout (Admin **Promote to everyone**), there is **no production / fleet agent publish**: updates stay on the canary allowlist (default: Soumitra only).

**Soak owner:** `soumitra.m.mandal@pwc.com` - local agent at `%LOCALAPPDATA%\OfficeTracker` pointing at `office-tracker-theta` (Hobby prod).

**Server gate (BUG-023):** `AppConfig.agentRolloutMode` defaults to **`allowlist`**. Sync/config/`agentScriptVersion` use `resolveAgentTargetVersion`: allowlisted users get canary (repo `version.txt` / `agentCanaryVersion`); everyone else gets `agentFleetStableVersion`. Do **not** set mode to `everyone` or promote without soak.

### NEVER do (without explicit user approval to roll out)

- Call **Promote to everyone** / set `agentRolloutMode=everyone` without soak
- Set **`forceAgentUpdate`** (admin Push) for the fleet or mass devices during canary soak
- Point `agentFleetStableVersion` at an unproven canary
- Treat "merge to production" as automatic fleet agent rollout (version gate must stay allowlist)

Laptop-only / Soumitra-only testing is the **default**. Rollout is **opt-in later**, never automatic.

### Allowed without fleet publish

- Edit `agent/` locally in the repo
- Bump `agent/version.txt` / `$AgentScriptVersion` while **`agentRolloutMode=allowlist`** and fleet-stable stays pinned (only canary pulls)
- Apply updates on Soumitra's laptop only (Copy update command / local install path)
- Run BUG-017 / BUG-023 and related tests locally

If unsure whether a change would reach the fleet: confirm rollout mode is still **allowlist** and fleet-stable is unchanged. Ask the user before promoting.

## Non-negotiable rules (BUG-017 parse safety)

1. **ASCII-only strings in agent scripts that become `.txt`.** No em dash (U+2014), en dash (U+2013), smart quotes, or other non-ASCII punctuation in `agent/**/*.ps1` (comments and user-facing summary lines included). Use ASCII `-`, commas, or parentheses. See **no-em-dash** skill.
2. **`Publish-AgentScriptTxt` must read and write UTF-8.**
   `Get-Content -LiteralPath $Ps1Path -Raw -Encoding UTF8` then `Set-Content ... -Encoding UTF8` in [`agent/lib/agent-download.ps1`](agent/lib/agent-download.ps1).
3. **Task runner path stays:** `run-heartbeat.vbs` → `Get-Content` `office-heartbeat.txt` → `Invoke-Expression`. Do not switch the fleet to `-File office-heartbeat.ps1` without a versioned migration plan.
4. **Bump `agent/version.txt` and `$AgentScriptVersion` together** only when an agent script change must reach laptops **and** BUG-018 rollout is approved (or the bump is laptop-only soak with no production publish).
5. **Soft update only runs when heartbeat can sync.** If a bad build breaks IEX, laptops cannot self-heal until someone runs **Copy update command** (or a local repair). Treat parse/IEX breakage as fleet-down.

## Independent watchdog boundary

`PwCOfficePulseWatchdog` is the recovery path for a broken heartbeat agent.

- Routine setup, soft update, force repair, and reinstall must leave an existing
  watchdog task and its files unchanged.
- Setup may bootstrap the watchdog only when the watchdog task is missing.
- The watchdog runs hourly and at logon, uses `-File watchdog.ps1`, and targets
  `agentFleetStableVersion`, not the canary version offered to an allowlisted user.
- The watchdog stages agent files outside the install directory, never downloads
  or replaces itself, verifies server SHA-256 headers, and commits the agent
  version only after setup succeeds.
- **Promote to everyone** snapshots the reviewed core agent files into
  `AgentReleaseArtifact`. The watchdog downloads from that immutable fleet-stable
  snapshot so a later canary deploy cannot leak into a recovery repair.
- A force agent repair preserves the watchdog directory. An explicit full
  uninstall removes both tasks and the complete install directory.
- Watchdog replacement is a separate, explicit risky operation through
  `watchdog/install-watchdog.ps1 -ReplaceExisting`. Never add it to routine agent
  auto-update.

## Before any agent change leaves Soumitra's laptop

Run all of:

```powershell
npm test -- tests/bugs/BUG-017-agent-iex-txt-must-parse.test.ts tests/bugs/BUG-018-soumitra-only-agent-soak.test.ts tests/agent-ps51-compat.test.ts tests/agent-version.test.ts
npm run test:bugs
```

### Soumitra laptop soak checklist (required before any fleet consideration)

After applying the change on Soumitra's machine only:

1. `%LOCALAPPDATA%\OfficeTracker\version.txt` matches the soak build under test.
2. Scheduled task still runs (PwCOfficePulse / equivalent); `logs\heartbeat.log` has a fresh `START v…` within ~3 minutes.
3. `office-heartbeat.txt` parses (no mojibake around summary strings) - **BUG-017**.
4. Heartbeat still posts (dashboard / device last seen updates).
5. Soft update log lines still appear when server version is newer (`Refreshing setup scripts` / `Auto-update finished`) - **by any cost keep this path alive**.

Only after soak looks good for a few days **and** the user explicitly says to roll out: consider production/fleet publish. Re-run BUG-017 first.

## If the fleet looks stuck

1. Confirm `heartbeat.log` stopped at the last auto-update (no new `START` while the task still fires).
2. Parse-check `office-heartbeat.txt` (PS parser errors = IEX dead).
3. Repair: Settings → **Copy update command**, or republish txt with UTF-8 from a good `.ps1`.
4. Add/extend BUG-017 if a new break mode appears. Do not "fix forward" with another fleet-wide version bump while BUG-018 soak is active.

## Related

- Catalog: `tests/bugs/BUG-017-agent-iex-txt-must-parse.test.ts`
- Catalog: `tests/bugs/BUG-018-soumitra-only-agent-soak.test.ts` + `fixtures/soumitra-only-agent-soak.json`
- Office Tracker skill: agent install/update section and development checklist
- Encoding fix: `Publish-AgentScriptTxt` in `agent/lib/agent-download.ps1`
