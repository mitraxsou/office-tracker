#Requires -Version 5.1
<#
.SYNOPSIS
  Remove misconfigured Vercel env vars (DATABASE_URL_* prefix) via REST API.

.DESCRIPTION
  Uses curl.exe (Windows system cert store) — works on PwC laptops where
  `npx vercel login` fails with corporate SSL inspection errors.

  Requires a personal access token from https://vercel.com/account/tokens
  (create in browser; no CLI login needed).

.PARAMETER WhatIf
  List vars that would be deleted without calling DELETE.

.PARAMETER ProjectId
  Vercel project ID (prj_...) or name. Defaults to VERCEL_PROJECT_ID env,
  .vercel/project.json, or "office-tracker".

.PARAMETER TeamId
  Team ID (team_...) when the project belongs to a team. Defaults to
  VERCEL_TEAM_ID env or .vercel/project.json orgId.

.EXAMPLE
  $env:VERCEL_TOKEN = "your_token"
  .\scripts\cleanup-vercel-env.ps1 -WhatIf

.EXAMPLE
  $env:VERCEL_TOKEN = "your_token"
  $env:VERCEL_PROJECT_ID = "prj_xxxxxxxx"
  .\scripts\cleanup-vercel-env.ps1
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$ProjectId = $env:VERCEL_PROJECT_ID,
    [string]$TeamId = $env:VERCEL_TEAM_ID,
    [switch]$WhatIf
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ApiBase = "https://api.vercel.com"

function Write-Info([string]$Message) {
    Write-Host $Message -ForegroundColor Cyan
}

function Write-Success([string]$Message) {
    Write-Host $Message -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host $Message -ForegroundColor Yellow
}

function Write-Err([string]$Message) {
    Write-Host $Message -ForegroundColor Red
}

function Resolve-ProjectConfig {
    param(
        [string]$ProjectId,
        [string]$TeamId
    )

    $repoRoot = Split-Path -Parent $PSScriptRoot
    if (-not $repoRoot) {
        $repoRoot = (Get-Location).Path
    }
    $linkFile = Join-Path $repoRoot ".vercel\project.json"

    if (-not $ProjectId -and (Test-Path -LiteralPath $linkFile)) {
        try {
            $linked = Get-Content -LiteralPath $linkFile -Raw | ConvertFrom-Json
            if ($linked.projectId) { $ProjectId = [string]$linked.projectId }
            elseif ($linked.projectName) { $ProjectId = [string]$linked.projectName }
            if (-not $TeamId -and $linked.orgId -and [string]$linked.orgId -like "team_*") {
                $TeamId = [string]$linked.orgId
            }
        }
        catch {
            Write-Warn "Could not read $linkFile — set VERCEL_PROJECT_ID manually."
        }
    }

    if (-not $ProjectId) {
        $ProjectId = "office-tracker"
        Write-Warn "Using default project name: office-tracker (set VERCEL_PROJECT_ID if wrong)."
    }

    return @{
        ProjectId = $ProjectId
        TeamId    = $TeamId
    }
}

function Get-TeamQuery([string]$TeamId) {
    if ($TeamId) {
        return "?teamId=$([uri]::EscapeDataString($TeamId))"
    }
    return ""
}

function Invoke-VercelCurl {
    param(
        [ValidateSet("GET", "DELETE", "POST", "PATCH")]
        [string]$Method = "GET",
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [string]$Body = $null,
        [hashtable]$Query = @{}
    )

    $token = $env:VERCEL_TOKEN
    if (-not $token) {
        throw "VERCEL_TOKEN is not set. Create a token at https://vercel.com/account/tokens and run:`n  `$env:VERCEL_TOKEN = `"your_token`""
    }

    $queryString = ""
    if ($Query.Count -gt 0) {
        $pairs = @()
        foreach ($key in $Query.Keys) {
            $pairs += "$key=$([uri]::EscapeDataString([string]$Query[$key]))"
        }
        $queryString = "?" + ($pairs -join "&")
    }

    $url = "$ApiBase$Path$queryString"
    $args = @(
        "-sS",
        "-w", "`n__HTTP_CODE__:%{http_code}",
        "-H", "Authorization: Bearer $token",
        "-H", "Accept: application/json"
    )

    $bodyFile = $null
    if ($Method -ne "GET") {
        $args += "-X", $Method
        $args += "-H", "Content-Type: application/json"
        if ($Body) {
            $bodyFile = [System.IO.Path]::GetTempFileName()
            [System.IO.File]::WriteAllText($bodyFile, $Body, [System.Text.UTF8Encoding]::new($false))
            $args += "--data-binary", "@$bodyFile"
        }
    }

    try {
        $raw = & curl.exe @args $url 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "curl.exe failed (exit $LASTEXITCODE): $raw"
        }

        $text = ($raw | Out-String).TrimEnd()
        $httpCode = $null
        if ($text -match "__HTTP_CODE__:(\d+)\s*$") {
            $httpCode = [int]$Matches[1]
            $text = ($text -replace "`n__HTTP_CODE__:\d+\s*$", "").TrimEnd()
        }

        if ($httpCode -and ($httpCode -lt 200 -or $httpCode -ge 300)) {
            $detail = if ($text) { $text } else { "(empty body)" }
            throw "Vercel API $Method $Path returned HTTP $httpCode`: $detail"
        }

        if (-not $text) {
            return $null
        }

        try {
            return $text | ConvertFrom-Json
        }
        catch {
            return $text
        }
    }
    finally {
        if ($bodyFile -and (Test-Path -LiteralPath $bodyFile)) {
            Remove-Item -LiteralPath $bodyFile -Force -ErrorAction SilentlyContinue
        }
    }
}

function Get-ProjectEnvVars {
    param(
        [string]$ProjectId,
        [string]$TeamId
    )

    $all = @()
    $teamQuery = Get-TeamQuery $TeamId
    $separator = if ($teamQuery) { "&" } else { "?" }

    # decrypt=true helps inspect DATABASE_URL values (deprecated but still works).
    $path = "/v10/projects/$([uri]::EscapeDataString($ProjectId))/env"
    $querySuffix = "${teamQuery}${separator}decrypt=true"

    $response = Invoke-VercelCurl -Method GET -Path "$path$querySuffix"

    if ($null -eq $response) {
        return @()
    }

    if ($response -is [System.Array]) {
        return @($response)
    }

    if ($response.envs) {
        return @($response.envs)
    }

    if ($response.PSObject.Properties.Name -contains "id" -and $response.PSObject.Properties.Name -contains "key") {
        return @($response)
    }

    return @()
}

function Test-PostgresConnectionString([string]$Value) {
    if (-not $Value) { return $false }
    $trimmed = $Value.Trim()
    return ($trimmed -match '^(postgresql|postgres)://')
}

function Test-ShellLikeValue([string]$Value) {
    if (-not $Value) { return $false }
    $trimmed = $Value.Trim()
    if ($trimmed -match '^(postgresql|postgres)://') { return $false }
    # Values that look like pasted shell / prisma CLI commands rather than URLs.
    return (
        $trimmed -match '^(npx|npm|pnpm|yarn)\s' -or
        $trimmed -match 'prisma\s' -or
        $trimmed -match '^\$\(' -or
        $trimmed -match '^[`"''].*[`"'']?\s*$' -and $trimmed -notmatch '^https?://'
    )
}

function Get-EnvVarValue([object]$EnvVar) {
    foreach ($prop in @("value", "vsmValue", "legacyValue")) {
        if ($EnvVar.PSObject.Properties.Name -contains $prop) {
            $v = [string]$EnvVar.$prop
            if ($v) { return $v }
        }
    }
    return ""
}

function Format-EnvTarget([object]$EnvVar) {
    if ($EnvVar.target) {
        return ($EnvVar.target -join ", ")
    }
    return "all"
}

function Should-RemoveEnvVar([object]$EnvVar) {
    $key = [string]$EnvVar.key
    $value = Get-EnvVarValue $EnvVar
    $reason = $null

    if ($key -like "DATABASE_URL_*") {
        $reason = "misconfigured Storage prefix (DATABASE_URL_*)"
    }
    elseif ($key -eq "DATABASE_URL") {
        if (-not (Test-PostgresConnectionString $value)) {
            if ($value) {
                $reason = "DATABASE_URL value is not a postgresql:// URL"
            }
            else {
                $reason = "DATABASE_URL has no readable value (likely invalid — remove and reconnect Storage)"
            }
        }
        elseif (Test-ShellLikeValue $value) {
            $reason = "DATABASE_URL looks like a shell command, not a connection string"
        }
    }

    if ($reason) {
        return @{ Remove = $true; Reason = $reason }
    }

    return @{ Remove = $false; Reason = $null }
}

# --- main ---

Write-Info "Vercel env cleanup — remove misconfigured DATABASE_URL_* vars"
Write-Host ""

$config = Resolve-ProjectConfig -ProjectId $ProjectId -TeamId $TeamId
$ProjectId = $config.ProjectId
$TeamId = $config.TeamId

Write-Info "Project: $ProjectId"
if ($TeamId) {
    Write-Info "Team:    $TeamId"
}
Write-Host ""

Write-Info "Fetching environment variables..."
$envVars = Get-ProjectEnvVars -ProjectId $ProjectId -TeamId $TeamId
Write-Info "Found $($envVars.Count) env var record(s)."
Write-Host ""

$toRemove = @()
$toKeep = @()

foreach ($ev in $envVars) {
    $decision = Should-RemoveEnvVar $ev
    if ($decision.Remove) {
        $toRemove += [PSCustomObject]@{
            Id     = [string]$ev.id
            Key    = [string]$ev.key
            Target = Format-EnvTarget $ev
            Reason = $decision.Reason
        }
    }
    else {
        $toKeep += [string]$ev.key
    }
}

if ($toRemove.Count -eq 0) {
    Write-Success "Nothing to delete — no DATABASE_URL_* prefixed vars or invalid DATABASE_URL found."
    Write-Host ""
    Write-Info "Current keys (sample):"
    $envVars | ForEach-Object { [string]$_.key } | Sort-Object -Unique | ForEach-Object { Write-Host "  - $_" }
    exit 0
}

Write-Warn "Will remove $($toRemove.Count) env var record(s):"
foreach ($item in $toRemove) {
    Write-Host "  - $($item.Key) [$($item.Target)] — $($item.Reason) (id: $($item.Id))"
}
Write-Host ""

if ($WhatIf -or $WhatIfPreference) {
    Write-Warn "WhatIf mode — no changes made."
    exit 0
}

$ids = @($toRemove | ForEach-Object { $_.Id } | Where-Object { $_ })
if ($ids.Count -eq 0) {
    Write-Err "Matched vars have no IDs — cannot delete."
    exit 1
}

Write-Info "Deleting via batch API (DELETE /v1/projects/.../env)..."
$teamQuery = Get-TeamQuery $TeamId
$deletePath = "/v1/projects/$([uri]::EscapeDataString($ProjectId))/env$teamQuery"
$body = (@{ ids = $ids } | ConvertTo-Json -Compress)

try {
    $result = Invoke-VercelCurl -Method DELETE -Path $deletePath -Body $body
}
catch {
    Write-Warn "Batch delete failed — trying one-by-one (DELETE /v9/projects/.../env/{id})..."
    $deleted = 0
    $failed = 0
    foreach ($item in $toRemove) {
        try {
            $singlePath = "/v9/projects/$([uri]::EscapeDataString($ProjectId))/env/$([uri]::EscapeDataString($item.Id))$teamQuery"
            Invoke-VercelCurl -Method DELETE -Path $singlePath | Out-Null
            Write-Success "  Deleted $($item.Key) [$($item.Target)]"
            $deleted++
        }
        catch {
            Write-Err "  Failed $($item.Key): $_"
            $failed++
        }
    }
    if ($failed -gt 0) {
        exit 1
    }
    $result = @{ deleted = $deleted; ids = $ids }
}

$deletedCount = if ($result.deleted) { [int]$result.deleted } else { $ids.Count }
Write-Host ""
Write-Success "Deleted $deletedCount env var record(s)."

Write-Host ""
Write-Info "Verifying remaining env vars..."
$remaining = Get-ProjectEnvVars -ProjectId $ProjectId -TeamId $TeamId
$remainingKeys = $remaining | ForEach-Object { [string]$_.key } | Sort-Object -Unique

$expectedGood = @("POSTGRES_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL_NON_POOLING")
$stillBad = $remainingKeys | Where-Object { $_ -like "DATABASE_URL_*" }

Write-Host ""
Write-Info "Remaining keys ($($remainingKeys.Count)):"
foreach ($key in $remainingKeys) {
    $marker = if ($expectedGood -contains $key) { " (Storage — OK)" } else { "" }
    Write-Host "  - $key$marker"
}

if ($stillBad) {
    Write-Warn "Some DATABASE_URL_* vars still present — re-run or delete manually in dashboard."
}

$missingPostgres = $expectedGood | Where-Object { $_ -notin $remainingKeys }
if ($missingPostgres) {
    Write-Host ""
    Write-Warn "Expected Storage vars not found yet: $($missingPostgres -join ', ')"
    Write-Warn "Reconnect Postgres in Vercel dashboard (Storage → Connect to Project, blank prefix)."
    Write-Warn "See scripts/vercel-env-setup.md"
}

Write-Host ""
Write-Success "Done. Redeploy the project after reconnecting Storage."
