# Smoke test: zip-folder reinstall command wiring (run from repo root in CI/dev).
$ErrorActionPreference = "Stop"
$agentDir = Join-Path $PSScriptRoot "..\..\agent"
if (-not (Test-Path (Join-Path $agentDir "setup.ps1"))) {
    throw "agent folder not found at $agentDir"
}

Set-Location $agentDir
. (Join-Path $agentDir "lib\agent-download.ps1")

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
    Invoke-AgentScriptBypass -Ps1Path (Join-Path $agentDir "setup.ps1") -BoundVars $bound -Wait | Out-Null
} catch {
    if ($_.Exception.Message -notmatch '401|403|Unauthorized|WebRequest|remote server') {
        throw
    }
}
Write-Output "OK"
