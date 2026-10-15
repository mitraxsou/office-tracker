# Smoke test: zip-folder reinstall command wiring (run from repo root in CI/dev).
$ErrorActionPreference = "Stop"
$agentDir = Join-Path $PSScriptRoot "..\..\agent"
if (-not (Test-Path (Join-Path $agentDir "setup.ps1"))) {
    throw "agent folder not found at $agentDir"
}

Set-Location $agentDir
. (Join-Path $agentDir "lib\agent-download.ps1")

# Never touch the real laptop install or open a visible window.
$env:OFFICETRACKER_INSTALL_DIR = Join-Path $env:TEMP "PwCOfficePulse-smoke-$([Guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $env:OFFICETRACKER_INSTALL_DIR -Force | Out-Null

$txt = Publish-AgentScriptTxt -Ps1Path (Join-Path $agentDir "setup.ps1")
$raw = Get-Content -Raw $txt
if ($raw -match '^\s*param\s*\(') {
    throw "Published setup still has param block"
}

$bound = @{
    ApiUrl = "https://office-tracker-theta.vercel.app"
    Token  = "smoke-test-invalid-token"
    Force  = $true
}
# Expect auth failure on download, not a parser/bypass failure
try {
    $exitCode = Invoke-AgentScriptBypass -Ps1Path (Join-Path $agentDir "setup.ps1") `
        -BoundVars $bound -Hidden -Wait
    if ($exitCode -eq 0) {
        throw "Invalid token was accepted"
    }
} finally {
    Remove-Item -LiteralPath $env:OFFICETRACKER_INSTALL_DIR -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Output "OK"
