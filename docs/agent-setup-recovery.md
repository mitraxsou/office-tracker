# Agent setup / update recovery (corrupt version.txt)

For a full **uninstall then reinstall** (no zip), use **Clean reinstall (laptop issues)** on the Settings install page: copy step 1 (uninstall), then step 2 (setup).


If the pasted **setup/update** command fails with:

`Cannot convert value "000…001" to type "System.Int32"`

the local `version.txt` under `%LOCALAPPDATA%\OfficeTracker` is likely corrupt (non-semver content). Setup compares versions during update; a bad file can crash older agents.

## Diagnose and re-run setup

Run in PowerShell (replace app URL and token as for a normal setup command):

```powershell
$dir = Join-Path $env:LOCALAPPDATA "OfficeTracker"
$vf = Join-Path $dir "version.txt"
if (Test-Path $vf) {
  Write-Host "--- version.txt (first 200 chars) ---"
  $raw = Get-Content $vf -Raw
  if ($raw.Length -gt 200) { Write-Host ($raw.Substring(0, 200) + "...") } else { Write-Host $raw }
  Remove-Item $vf -Force
  Write-Host "Removed corrupt version.txt"
} else {
  Write-Host "No version.txt at $vf"
}
```

Then paste the **Update agent** command from the web app (Settings / admin install token UI) again.

If setup says **`ApiUrl and Token are required for a fresh install`** while the pasted command clearly sets them, the laptop is still running an older bootstrap (`Publish-AgentScriptTxt` + `Invoke-Expression`) against `setup.ps1` that used a `param()` block. **Copy a fresh command** from the app after deploy, or set env vars then re-run:

```powershell
$env:OFFICEPULSE_SETUP_API_URL = "https://office-tracker-theta.vercel.app"
$env:OFFICEPULSE_SETUP_TOKEN = "<agent-token>"
```

Then paste the update command again. Agent **1.5.2+** removes script-level `param()` from `setup.ps1` so IEX preserves caller `$ApiUrl` / `$Token`.

After agent **1.5.1+** is installed, corrupt `version.txt` is ignored (treated as `0.0.0`) and downloaded `version.txt` is validated before install.
