# End-to-end: download zip from app, run Settings-style reinstall (optional uninstall first).
param(
    [string]$AppUrl = "https://office-tracker-theta.vercel.app",
    [string]$Token = "",
    [switch]$SkipUninstall
)
$ErrorActionPreference = "Stop"

$apiUrl = $AppUrl.TrimEnd("/")
$token = $Token.Trim()
if (-not $token) {
    $clip = (Get-Clipboard -Raw -ErrorAction SilentlyContinue).Trim()
    if ($clip -match '^[a-f0-9]{64}$') { $token = $clip }
    elseif ($clip -match "\$Token=''([a-f0-9]{64})''") { $token = $Matches[1] }
}
if (-not $token) { throw "Set -Token or copy your 64-char install token (or full reinstall command) to the clipboard." }

$configPath = Join-Path $env:LOCALAPPDATA "OfficeTracker\config.json"
if (-not $SkipUninstall) {
    $installDir = Join-Path $env:LOCALAPPDATA "OfficeTracker"
    $uninstall = Join-Path $installDir "uninstall.ps1"
    if (Test-Path -LiteralPath $uninstall) {
        Write-Host "Running uninstall.ps1..."
        & $uninstall
        if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) { exit $LASTEXITCODE }
    } elseif (Test-Path -LiteralPath $installDir) {
        Write-Host "Removing existing install dir..."
        Remove-Item -LiteralPath $installDir -Recurse -Force
    }
} else {
    Write-Host "SkipUninstall: agent folder left as-is if present."
}

Write-Host "Using apiUrl=$apiUrl"

$work = Join-Path $env:TEMP ("OfficePulse-e2e-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $work -Force | Out-Null
$zipPath = Join-Path $work "PwCOfficePulse-agent.zip"
$extract = Join-Path $work "extract"
New-Item -ItemType Directory -Path $extract -Force | Out-Null

Write-Host "Downloading agent zip from $apiUrl ..."
$dlUrl = $apiUrl + "/api/agent/download"
curl.exe -sS -f -L -H "Authorization: Bearer $token" -o $zipPath $dlUrl
if (-not (Test-Path -LiteralPath $zipPath) -or (Get-Item -LiteralPath $zipPath).Length -lt 1024) {
    throw "Download failed or zip too small. Check token and deployment."
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $extract)

$folder = Get-ChildItem -LiteralPath $extract -Directory | Where-Object { $_.Name -eq "PwCOfficePulse" } | Select-Object -First 1
if (-not $folder) {
    $nested = Get-ChildItem -LiteralPath $extract -Recurse -Directory -Filter "PwCOfficePulse" | Select-Object -First 1
    if ($nested) { $folder = $nested } else { throw "PwCOfficePulse folder not found in zip" }
}
$zipRoot = $folder.FullName

$libDl = Join-Path $zipRoot "lib\agent-download.ps1"
$libSt = Join-Path $zipRoot "lib\agent-storage.ps1"
$setup = Join-Path $zipRoot "setup.ps1"
foreach ($p in @($libDl, $libSt, $setup)) {
    if (-not (Test-Path -LiteralPath $p)) { throw "Missing in zip: $p" }
}
Write-Host "Zip OK: lib helpers and setup.ps1 present under $($folder.Name)"

Set-Location -LiteralPath $zipRoot
. $libDl
. $libSt
$ApiUrl = $apiUrl
$Token = $token
$env:OFFICEPULSE_SETUP_API_URL = $ApiUrl
$env:OFFICEPULSE_SETUP_TOKEN = $Token
Write-Host "Running Invoke-AgentScriptBypass (Force)..."
$code = Invoke-AgentScriptBypass -Ps1Path $setup -BoundVars @{ ApiUrl = $ApiUrl; Token = $Token; Force = $true } -Wait
if ($code -ne 0) { throw "setup exited with code $code" }

$newConfig = Join-Path $env:LOCALAPPDATA "OfficeTracker\config.json"
if (-not (Test-Path -LiteralPath $newConfig)) { throw "Install did not create config.json" }
$task = Get-ScheduledTask -TaskName "PwCOfficePulse" -ErrorAction SilentlyContinue
if (-not $task) { throw "Scheduled task PwCOfficePulse not found after install" }
Write-Host "OK: config.json and PwCOfficePulse task present."
Write-Host "Task state: $($task.State)"
