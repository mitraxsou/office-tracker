# Build PwCOfficePulse-agent.zip locally (same layout as GET /api/agent/download).
$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$outZip = Join-Path $env:TEMP "PwCOfficePulse-agent-local.zip"
$staging = Join-Path $env:TEMP ("OfficePulse-zip-" + [guid]::NewGuid().ToString("N"))
$root = Join-Path $staging "PwCOfficePulse"
New-Item -ItemType Directory -Path (Join-Path $root "lib") -Force | Out-Null

$map = @{
    "install.ps1" = "install.ps1"
    "office-heartbeat.ps1" = "office-heartbeat.ps1"
    "uninstall.ps1" = "uninstall.ps1"
    "update.ps1" = "update.ps1"
    "setup.ps1" = "setup.ps1"
    "version.txt" = "version.txt"
    "agent-download.ps1" = "lib\agent-download.ps1"
    "agent-storage.ps1" = "lib\agent-storage.ps1"
}
$agentDir = Join-Path $repoRoot "agent"
foreach ($entry in $map.GetEnumerator()) {
    $src = Join-Path $agentDir $entry.Value
    $dest = Join-Path $root $entry.Value
    $destDir = Split-Path $dest -Parent
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item -LiteralPath $src -Destination $dest -Force
}
if (Test-Path -LiteralPath $outZip) { Remove-Item -LiteralPath $outZip -Force }
Compress-Archive -Path (Join-Path $staging "PwCOfficePulse") -DestinationPath $outZip -Force
Write-Output $outZip
