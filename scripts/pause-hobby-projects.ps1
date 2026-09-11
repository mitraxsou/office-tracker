#Requires -Version 5.1
<#
.SYNOPSIS
  Pause Hobby Vercel projects so git pushes only affect Enterprise CDTR.

.EXAMPLE
  $env:VERCEL_TOKEN = "token-scoped-to-soumitra-pwc"
  .\scripts\pause-hobby-projects.ps1
#>
[CmdletBinding()]
param(
    [string]$TeamId = "team_3LPxagkp9owYBE8nVXkQAg7H",
    [string[]]$ProjectNames = @("office-tracker", "office-tracker-dev")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $env:VERCEL_TOKEN) {
    throw "VERCEL_TOKEN required. Create one at https://vercel.com/account/tokens scoped to team soumitra-pwc."
}

$headers = @{
    Authorization  = "Bearer $env:VERCEL_TOKEN"
    "Content-Type" = "application/json"
}

foreach ($name in $ProjectNames) {
    Write-Host "Pausing $name ..."
    $project = Invoke-RestMethod -Headers $headers -Uri "https://api.vercel.com/v9/projects/$name`?teamId=$TeamId"
    Invoke-RestMethod -Headers $headers -Method POST -Body "{}" `
        -Uri "https://api.vercel.com/v1/projects/$($project.id)/pause?teamId=$TeamId" | Out-Null
    Write-Host "  Paused $($project.id) ($name)"
}

Write-Host "Done. Visitors to Hobby URLs will see DEPLOYMENT_PAUSED until you unpause or use Enterprise URLs."
