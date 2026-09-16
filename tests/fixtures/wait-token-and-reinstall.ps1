param([string]$AppUrl = "https://office-tracker-theta.vercel.app")
$ErrorActionPreference = "Stop"
$apiUrl = $AppUrl.TrimEnd("/")

function Get-TokenFromText([string]$text) {
    $text = $text.Trim()
    if ($text -match '^[a-f0-9]{64}$') { return $text }
    if ($text -match "\$Token=''([a-f0-9]{64})''") { return $Matches[1] }
    if ($text -match "\$Token='([a-f0-9]{64})'") { return $Matches[1] }
    return $null
}

function Test-AgentToken([string]$token) {
    try {
        $req = [System.Net.HttpWebRequest]::Create("$apiUrl/api/agent/config")
        $req.Method = "GET"
        $req.Headers.Add("Authorization", "Bearer $token")
        $req.Timeout = 20000
        $resp = $req.GetResponse()
        $code = [int]$resp.StatusCode
        $resp.Close()
        return $code -eq 200
    } catch [System.Net.WebException] {
        if ($_.Exception.Response) {
            return $false
        }
        throw
    }
}

Write-Host "Copy your reinstall command from Settings (theta), then wait..."
$token = $null
for ($i = 0; $i -lt 36; $i++) {
    $clip = Get-Clipboard -Raw -ErrorAction SilentlyContinue
    $candidate = Get-TokenFromText $clip
    if ($candidate -and (Test-AgentToken $candidate)) {
        $token = $candidate
        Write-Host "Valid agent token detected."
        break
    }
    Start-Sleep -Seconds 5
}
if (-not $token) {
    throw "No valid agent token on clipboard after 3 minutes. Copy reinstall command from Settings."
}

$zipPath = & (Join-Path $PSScriptRoot "build-local-agent-zip.ps1")
if (-not $zipPath) { $zipPath = Join-Path $env:TEMP "PwCOfficePulse-agent-local.zip" }
$work = Join-Path $env:TEMP ("OfficePulse-e2e-" + [guid]::NewGuid().ToString("N"))
$extract = Join-Path $work "extract"
New-Item -ItemType Directory -Path $extract -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $extract)
$zipRoot = Join-Path $extract "PwCOfficePulse"
if (-not (Test-Path $zipRoot)) { throw "Bad local zip layout" }

# Also verify server zip when token works
$serverZip = Join-Path $work "server.zip"
$req = [System.Net.HttpWebRequest]::Create("$apiUrl/api/agent/download")
$req.Method = "GET"
$req.Headers.Add("Authorization", "Bearer $token")
$resp = $req.GetResponse()
$stream = $resp.GetResponseStream()
$fs = [System.IO.File]::Create($serverZip)
$stream.CopyTo($fs)
$fs.Close()
$resp.Close()
$len = (Get-Item $serverZip).Length
Write-Host "Server zip downloaded ($len bytes)."

$serverExtract = Join-Path $work "server-extract"
New-Item -ItemType Directory -Path $serverExtract -Force | Out-Null
[System.IO.Compression.ZipFile]::ExtractToDirectory($serverZip, $serverExtract)
$serverLib = Join-Path $serverExtract "PwCOfficePulse\lib\agent-download.ps1"
if (-not (Test-Path -LiteralPath $serverLib)) { throw "Server zip missing lib\agent-download.ps1" }
Write-Host "Server zip OK: lib\agent-download.ps1 present."

Set-Location $zipRoot
. (Join-Path $zipRoot "lib\agent-download.ps1")
. (Join-Path $zipRoot "lib\agent-storage.ps1")
$ApiUrl = $apiUrl
$Token = $token
$env:OFFICEPULSE_SETUP_API_URL = $ApiUrl
$env:OFFICEPULSE_SETUP_TOKEN = $Token
$setup = Join-Path $zipRoot "setup.ps1"
Write-Host "Running setup from extracted zip (Settings-style bypass)..."
$code = Invoke-AgentScriptBypass -Ps1Path $setup -BoundVars @{ ApiUrl = $ApiUrl; Token = $Token; Force = $true } -Wait
if ($code -ne 0) { throw "setup exit $code" }

if (-not (Test-Path (Join-Path $env:LOCALAPPDATA "OfficeTracker\config.json"))) {
    throw "config.json missing after install"
}
$task = Get-ScheduledTask -TaskName "PwCOfficePulse" -ErrorAction SilentlyContinue
if (-not $task) { throw "PwCOfficePulse task missing" }
Write-Host "SUCCESS: agent reinstalled; task state $($task.State)"
