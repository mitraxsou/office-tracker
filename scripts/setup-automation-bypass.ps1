#Requires -Version 5.1
<#
.SYNOPSIS
  Enable Vercel Protection Bypass for Automation on Enterprise Office Pulse projects.

.DESCRIPTION
  Creates or verifies a 32-character bypass secret on each project, marks it as
  VERCEL_AUTOMATION_BYPASS_SECRET, saves the value locally (gitignored), and
  optionally syncs env vars. Does not print full secret values.

.EXAMPLE
  $env:VERCEL_TOKEN = "your-token"
  .\scripts\setup-automation-bypass.ps1

.EXAMPLE
  .\scripts\setup-automation-bypass.ps1 -CheckOnly
#>
[CmdletBinding()]
param(
    [ValidateSet("dev", "prod", "both")]
    [string]$Target = "both",
    [switch]$CheckOnly,
    [switch]$SyncEnv,
    [string]$TeamId = "team_aibOHBi06MpPxWdFWRGDp9iK",
    [string]$BypassFile = ".env.vercel.enterprise.bypass.local"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $env:VERCEL_TOKEN) {
    throw @"
VERCEL_TOKEN required. Create one at https://vercel.com/account/tokens (scope to team pwc-us-adv-cdtr), then:
  `$env:VERCEL_TOKEN = 'paste-here'
  .\scripts\setup-automation-bypass.ps1
"@
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$bypassPath = Join-Path $repoRoot $BypassFile

$projects = @{
    dev = @{
        Name = "office-tracker-dev-9824"
        Id   = "prj_lhha3DVceqlTtU2A4HGdNaM32Sk6"
        Url  = "https://office-tracker-dev-9824.vercel.app"
    }
    prod = @{
        Name = "office-tracker-prod"
        Id   = "prj_N8idhB3WNItVngojCQAmOT5bsnSI"
        Url  = "https://office-tracker-prod.vercel.app"
    }
}

function Invoke-VercelJson {
    param(
        [ValidateSet("GET", "POST", "PATCH", "DELETE")]
        [string]$Method,
        [string]$Url,
        [string]$Body
    )
    $curlArgs = @(
        "--ssl-no-revoke", "--silent", "--show-error", "--fail-with-body",
        "--request", $Method,
        "--header", "Authorization: Bearer $env:VERCEL_TOKEN",
        "--header", "Content-Type: application/json"
    )
    if ($Body) { $curlArgs += @("--data", $Body) }
    $curlArgs += $Url
    $output = & curl.exe @curlArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        $text = ($output | Out-String).Trim()
        if ($text -match "projectProtectionBypass" -or $text -match "protection bypass") {
            throw @"
Vercel API denied protection bypass ($Method): $text
Your token can read the project but cannot create Protection Bypass for Automation.
Ask a pwc-us-adv-cdtr team OWNER to either run this script or create the bypass in
Vercel dashboard: Settings -> Deployment Protection -> Protection Bypass for Automation.
See docs/deploy-branches.md for manual steps.
"@
        }
        throw "Vercel API failed ($Method $Url): $text"
    }
    if (-not $output) { return $null }
    return ($output -join "`n") | ConvertFrom-Json
}

function New-VercelBypassSecret {
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return -join (0..31 | ForEach-Object { $chars[$bytes[$_] % $chars.Length] })
}

function Mask-Secret {
    param([string]$Value)
    if (-not $Value) { return "(none)" }
    if ($Value.Length -le 8) { return "(short)" }
    return "$($Value.Substring(0, 8))..."
}

function Get-ProjectDetails {
    param([string]$ProjectName)
    $url = "https://api.vercel.com/v9/projects/$([Uri]::EscapeDataString($ProjectName))?teamId=$([Uri]::EscapeDataString($TeamId))"
    return Invoke-VercelJson -Method GET -Url $url
}

function Get-EnvVarKeys {
    param([string]$ProjectName)
    $url = "https://api.vercel.com/v9/projects/$([Uri]::EscapeDataString($ProjectName))/env?teamId=$([Uri]::EscapeDataString($TeamId))"
    $resp = Invoke-VercelJson -Method GET -Url $url
    $keys = @()
    if ($resp.envs) {
        foreach ($row in $resp.envs) { $keys += $row.key }
    }
    return $keys
}

function Get-ProtectionBypassStatus {
    param([string]$ProjectName)
    $project = Get-ProjectDetails -ProjectName $ProjectName
    $bypassMap = if ($project.PSObject.Properties.Name -contains "protectionBypass") {
        $project.protectionBypass
    } else {
        $null
    }
    $secrets = @()
    if ($bypassMap) {
        foreach ($prop in $bypassMap.PSObject.Properties) {
            $entry = $prop.Value
            $secrets += @{
                Secret   = $prop.Name
                IsEnvVar = [bool]$entry.isEnvVar
                Note     = [string]$entry.note
            }
        }
    }
    $envKeys = Get-EnvVarKeys -ProjectName $ProjectName
    return @{
        ProjectName      = $ProjectName
        BypassCount      = $secrets.Count
        EnvVarBypass     = ($secrets | Where-Object { $_.IsEnvVar } | Select-Object -First 1)
        HasAutomationEnv = $envKeys -contains "VERCEL_AUTOMATION_BYPASS_SECRET"
        HasLegacyEnv     = $envKeys -contains "VERCEL_PROTECTION_BYPASS_SECRET"
        Secrets          = $secrets
    }
}

function Set-ProtectionBypassSecret {
    param(
        [string]$ProjectName,
        [string]$Secret
    )
    $base = "https://api.vercel.com/v1/projects/$([Uri]::EscapeDataString($ProjectName))/protection-bypass?teamId=$([Uri]::EscapeDataString($TeamId))"
    $generateBody = @{
        generate = @{
            secret = $Secret
            note   = "Office Pulse agent automation"
        }
    } | ConvertTo-Json -Compress
    Invoke-VercelJson -Method PATCH -Url $base -Body $generateBody | Out-Null

    $updateBody = @{
        update = @{
            secret   = $Secret
            isEnvVar = $true
            note     = "Office Pulse agent automation"
        }
    } | ConvertTo-Json -Compress
    Invoke-VercelJson -Method PATCH -Url $base -Body $updateBody | Out-Null
}

function Save-LocalBypassFile {
    param([string]$Secret)
    $line = "VERCEL_AUTOMATION_BYPASS_SECRET=$Secret"
    if (Test-Path -LiteralPath $bypassPath) {
        $lines = Get-Content -LiteralPath $bypassPath | Where-Object { $_ -notmatch '^VERCEL_AUTOMATION_BYPASS_SECRET=' }
        $lines += $line
        $lines | Set-Content -LiteralPath $bypassPath -Encoding utf8
    } else {
        @(
            "# Gitignored. Used by sync-enterprise-env.ps1 for both dev and prod.",
            "# Created by scripts/setup-automation-bypass.ps1",
            $line
        ) | Set-Content -LiteralPath $bypassPath -Encoding utf8
    }
    Write-Host "  Saved VERCEL_AUTOMATION_BYPASS_SECRET to $BypassFile (masked: $(Mask-Secret $Secret))" -ForegroundColor Green
}

function Test-BypassDownload {
    param(
        [string]$AppUrl,
        [string]$Secret
    )
    $url = "$($AppUrl.TrimEnd('/'))/api/agent/files/version.txt"
    $status = & curl.exe --ssl-no-revoke -sS -o NUL -w "%{http_code}" `
        -H "x-vercel-protection-bypass: $Secret" `
        $url 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "  Bypass test curl failed for $url"
        return
    }
    if ($status -eq "401") {
        Write-Host "  Bypass test: HTTP $status (SSO bypass OK; app requires Bearer token for agent files)" -ForegroundColor Green
    } elseif ($status -eq "200") {
        Write-Host "  Bypass test: HTTP $status" -ForegroundColor Green
    } elseif ($status -eq "302") {
        Write-Warning "  Bypass test: HTTP $status (still redirecting to SSO; redeploy may be required)"
    } else {
        Write-Warning "  Bypass test: HTTP $status for $url"
    }
}

$targets = if ($Target -eq "both") { @("dev", "prod") } else { @($Target) }
$sharedSecret = $null

Write-Host "Vercel automation bypass setup (team $TeamId)" -ForegroundColor Cyan
Write-Host ""

foreach ($key in $targets) {
    $proj = $projects[$key]
    Write-Host "[$key] $($proj.Name)" -ForegroundColor Cyan
    $status = Get-ProtectionBypassStatus -ProjectName $proj.Name
    Write-Host "  Protection bypass secrets: $($status.BypassCount)"
    Write-Host "  VERCEL_AUTOMATION_BYPASS_SECRET env var present: $($status.HasAutomationEnv)"

    if ($status.EnvVarBypass) {
        $masked = Mask-Secret $status.EnvVarBypass.Secret
        Write-Host "  Active env-var bypass: $masked" -ForegroundColor Green
        if (-not $sharedSecret) { $sharedSecret = $status.EnvVarBypass.Secret }
    } elseif ($status.BypassCount -gt 0) {
        $first = $status.Secrets[0]
        Write-Host "  Bypass exists but isEnvVar=false (masked: $(Mask-Secret $first.Secret))" -ForegroundColor Yellow
        if (-not $CheckOnly -and -not $sharedSecret) {
            $sharedSecret = $first.Secret
            Set-ProtectionBypassSecret -ProjectName $proj.Name -Secret $sharedSecret
            Write-Host "  Marked existing bypass as VERCEL_AUTOMATION_BYPASS_SECRET" -ForegroundColor Green
        }
    } else {
        Write-Host "  No protection bypass secret configured" -ForegroundColor Yellow
        if ($CheckOnly) { continue }

        if (-not $sharedSecret) {
            $sharedSecret = New-VercelBypassSecret
            Write-Host "  Generated new secret (masked: $(Mask-Secret $sharedSecret))"
        }
        Set-ProtectionBypassSecret -ProjectName $proj.Name -Secret $sharedSecret
        Write-Host "  Created protection bypass and set isEnvVar=true" -ForegroundColor Green
    }
    Write-Host ""
}

if ($CheckOnly) {
    Write-Host "CheckOnly: no changes made." -ForegroundColor Yellow
    exit 0
}

if (-not $sharedSecret) {
    throw "No bypass secret available to save locally. Re-run without -CheckOnly or create one in the Vercel dashboard."
}

Save-LocalBypassFile -Secret $sharedSecret

if ($SyncEnv) {
    Write-Host "Syncing env vars to Enterprise projects..." -ForegroundColor Cyan
    & (Join-Path $PSScriptRoot "sync-enterprise-env.ps1") -Profile dev
    & (Join-Path $PSScriptRoot "sync-enterprise-env.ps1") -Profile prod
}

Write-Host ""
Write-Host "Redeploy both Enterprise projects so runtime picks up VERCEL_AUTOMATION_BYPASS_SECRET." -ForegroundColor Yellow
Write-Host "Test (Bearer token still required for agent files; bypass only skips SSO):" -ForegroundColor Cyan
Write-Host '  curl.exe -H "x-vercel-protection-bypass: <secret>" -H "Authorization: Bearer <agent-token>" https://office-tracker-prod.vercel.app/api/agent/files/version.txt'
Write-Host ""

foreach ($key in $targets) {
    $proj = $projects[$key]
    Test-BypassDownload -AppUrl $proj.Url -Secret $sharedSecret
}
