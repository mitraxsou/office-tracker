---
name: agent-auto-update
description: >-
  Hard gate for Windows agent auto-update safety in OfficeTracker. Use whenever
  editing agent/, agent download/update APIs, Publish-AgentScriptTxt,
  run-heartbeat.vbs, setup.ps1, update.ps1, office-heartbeat.ps1, version.txt,
  or any change that ships to laptops. Prevents pushes that stop the scheduled
  task / IEX .txt runner for the fleet.
---

# Agent auto-update must never break

A bad agent ship can silence every laptop: the task still "runs" (wscript exits 0) while `office-heartbeat.txt` fails to parse, so no sync, no soft update, no recovery without a manual Settings update.

**Incident:** Agent 1.5.23 wrote an em dash into the last-run summary. `Publish-AgentScriptTxt` read the `.ps1` with the system ANSI code page, mojibaked `office-heartbeat.txt`, and `Invoke-Expression` died every 2 minutes. See **BUG-017**.

## Non-negotiable rules

1. **ASCII-only strings in agent scripts that become `.txt`.** No em dash (`—` U+2014), en dash (`–` U+2013), smart quotes, or other non-ASCII punctuation in `agent/**/*.ps1` (comments and user-facing summary lines included). Use `-`, commas, or parentheses.
2. **`Publish-AgentScriptTxt` must read and write UTF-8.**
   `Get-Content -LiteralPath $Ps1Path -Raw -Encoding UTF8` then `Set-Content ... -Encoding UTF8` in [`agent/lib/agent-download.ps1`](agent/lib/agent-download.ps1).
3. **Task runner path stays:** `run-heartbeat.vbs` → `Get-Content` `office-heartbeat.txt` → `Invoke-Expression`. Do not switch the fleet to `-File office-heartbeat.ps1` without a versioned migration plan.
4. **Bump `agent/version.txt` and `$AgentScriptVersion` together** on every agent script change that must reach laptops. Web `APP_VERSION` alone does not move agents.
5. **Soft update only runs when heartbeat can sync.** If a bad build breaks IEX, laptops cannot self-heal until someone runs **Copy update command** (or a local repair). Treat parse/IEX breakage as fleet-down.

## Before you push any `agent/` change

Run all of:

```powershell
npm test -- tests/bugs/BUG-017-agent-iex-txt-must-parse.test.ts tests/agent-ps51-compat.test.ts tests/agent-version.test.ts
npm run test:bugs
```

Manual check on a PwC laptop (or the author laptop) after deploy of a new agent version:

1. `%LOCALAPPDATA%\OfficeTracker\version.txt` matches server `agent/version.txt`.
2. `logs\heartbeat.log` has a fresh `START v…` within ~3 minutes.
3. `office-heartbeat.txt` parses (no mojibake around summary strings).
4. Soft update log lines still appear when server version is newer (`Refreshing setup scripts` / `Auto-update finished`).

## If the fleet looks stuck

1. Confirm `heartbeat.log` stopped at the last auto-update (no new `START` while the task still fires).
2. Parse-check `office-heartbeat.txt` (PS parser errors = IEX dead).
3. Repair: Settings → **Copy update command**, or republish txt with UTF-8 from a good `.ps1`.
4. Add/extend BUG-017 if a new break mode appears.

## Related

- Catalog: `tests/bugs/BUG-017-agent-iex-txt-must-parse.test.ts`
- Office Tracker skill: agent install/update section and development checklist
- Encoding fix: `Publish-AgentScriptTxt` in `agent/lib/agent-download.ps1`
