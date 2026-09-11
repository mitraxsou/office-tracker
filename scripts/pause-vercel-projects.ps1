#Requires -Version 5.1
<#
.SYNOPSIS
  Pause every accessible Vercel project except the production project.

.DESCRIPTION
  Uses curl.exe so it works with the Windows certificate store on PwC laptops.
  Requires VERCEL_TOKEN from https://vercel.com/account/tokens.

.EXAMPLE
  $env:VERCEL_TOKEN = "your-token"
  .\scripts\pause-vercel-projects.ps1 -WhatIf
  .\scripts\pause-vercel-projects.ps1
#>
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "High")]
param(
    [string]$KeepProject = "office-tracker",
    [string]$TeamId = $env:VERCEL_TEAM_ID
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $env:VERCEL_TOKEN) {
    throw "VERCEL_TOKEN is required. Create one at https://vercel.com/account/tokens and set it for this PowerShell session."
}

function Invoke-VercelApi {
    param(
        [ValidateSet("GET", "POST")]
        [string]$Method,
        [string]$Url
    )

    $output = & curl.exe --silent --show-error --fail-with-body `
        --request $Method `
        --header "Authorization: Bearer $env:VERCEL_TOKEN" `
        --header "Content-Type: application/json" `
        $Url 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Vercel API request failed: $output"
    }
    if (-not $output) { return $null }
    return ($output -join "`n") | ConvertFrom-Json
}

$query = "?limit=100"
if ($TeamId) {
    $query += "&teamId=$([Uri]::EscapeDataString($TeamId))"
}

$result = Invoke-VercelApi -Method GET -Url "https://api.vercel.com/v9/projects$query"
$projects = @($result.projects)
$keepMatches = @($projects | Where-Object { $_.name -eq $KeepProject })
if ($keepMatches.Count -ne 1) {
    throw "Expected exactly one project named '$KeepProject', found $($keepMatches.Count). No projects were paused."
}

$toPause = @($projects | Where-Object { $_.name -ne $KeepProject -and -not $_.paused })
Write-Host "Keeping production project: $KeepProject" -ForegroundColor Green
if ($toPause.Count -eq 0) {
    Write-Host "No other active projects found." -ForegroundColor Green
    exit 0
}

Write-Host "Projects selected for pause:" -ForegroundColor Yellow
$toPause | ForEach-Object { Write-Host "  $($_.name) [$($_.id)]" }

foreach ($project in $toPause) {
    if ($PSCmdlet.ShouldProcess($project.name, "Pause Vercel project")) {
        $pauseUrl = "https://api.vercel.com/v1/projects/$([Uri]::EscapeDataString($project.id))/pause"
        if ($TeamId) {
            $pauseUrl += "?teamId=$([Uri]::EscapeDataString($TeamId))"
        }
        Invoke-VercelApi -Method POST -Url $pauseUrl | Out-Null
        Write-Host "Paused: $($project.name)" -ForegroundColor Green
    }
}
