#Requires -Version 5.1
<#
.SYNOPSIS
  Move Office Tracker projects to a PwC Enterprise Vercel team.

.DESCRIPTION
  Uses curl.exe (works behind PwC SSL inspection). Tries, in order:
  1. Transfer existing projects from Hobby/personal scope to Enterprise team
  2. If transfer is blocked, create new projects on Enterprise via GitHub import

  Requires VERCEL_TOKEN from https://vercel.com/account/tokens (browser only).

.EXAMPLE
  $env:VERCEL_TOKEN = "your-token"
  .\scripts\migrate-to-enterprise.ps1 -WhatIf

.EXAMPLE
  $env:VERCEL_TOKEN = "your-token"
  .\scripts\migrate-to-enterprise.ps1 -DestinationTeamSlug "pwc-us-adv-cdtr"
#>
[CmdletBinding()]
param(
    [switch]$Force,
    [string]$DestinationTeamSlug = "pwc-us-adv-cdtr",
    [string[]]$ProjectNames = @("office-tracker", "office-tracker-dev"),
    [string]$GitHubRepo = "mitraxsou/office-tracker",
    [hashtable]$ProductionBranches = @{
        "office-tracker"     = "production"
        "office-tracker-dev" = "dev"
    }
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $env:VERCEL_TOKEN) {
    throw @"
VERCEL_TOKEN is required.
1. Open https://vercel.com/account/tokens in your browser
2. Create Token (full account access)
3. In PowerShell: `$env:VERCEL_TOKEN = 'paste-here'
4. Re-run this script
"@
}

function Invoke-VercelApi {
    param(
        [ValidateSet("GET", "POST", "PUT", "PATCH", "DELETE")]
        [string]$Method,
        [string]$Url,
        [string]$Body
    )

    $curlArgs = @(
        "--ssl-no-revoke",
        "--silent", "--show-error", "--fail-with-body",
        "--request", $Method,
        "--header", "Authorization: Bearer $env:VERCEL_TOKEN",
        "--header", "Content-Type: application/json"
    )
    if ($Body) {
        $curlArgs += @("--data", $Body)
    }
    $curlArgs += $Url

    $output = & curl.exe @curlArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Vercel API failed ($Method $Url): $output"
    }
    if (-not $output) { return $null }
    return ($output -join "`n") | ConvertFrom-Json
}

function Get-Teams {
    $result = Invoke-VercelApi -Method GET -Url "https://api.vercel.com/v2/teams?limit=100"
    return @($result.teams)
}

function Get-Projects {
    param([string]$TeamId)

    $query = "?limit=100"
    if ($TeamId) {
        $query += "&teamId=$([Uri]::EscapeDataString($TeamId))"
    }
    $result = Invoke-VercelApi -Method GET -Url "https://api.vercel.com/v9/projects$query"
    return @($result.projects)
}

function Start-ProjectTransfer {
    param(
        [string]$ProjectId,
        [string]$ProjectName,
        [string]$SourceTeamId
    )

    $query = ""
    if ($SourceTeamId) {
        $query = "?teamId=$([Uri]::EscapeDataString($SourceTeamId))"
    }

    Write-Host "  Requesting transfer for $ProjectName ($ProjectId)..." -ForegroundColor Cyan
    $result = Invoke-VercelApi -Method POST -Url "https://api.vercel.com/v10/projects/$([Uri]::EscapeDataString($ProjectId))/transfer-request$query"
    return $result.code
}

function Complete-ProjectTransfer {
    param(
        [string]$Code,
        [string]$DestinationTeamId
    )

    $url = "https://api.vercel.com/v10/projects/transfer-request/$([Uri]::EscapeDataString($Code))?teamId=$([Uri]::EscapeDataString($DestinationTeamId))"
    Invoke-VercelApi -Method PUT -Url $url | Out-Null
}

function New-EnterpriseProject {
    param(
        [string]$Name,
        [string]$TeamId,
        [string]$ProductionBranch
    )

    $body = @{
        name = $Name
        framework = "nextjs"
        buildCommand = "npm run build"
        installCommand = "npm install"
        gitRepository = @{
            type = "github"
            repo = $GitHubRepo
        }
    } | ConvertTo-Json -Depth 5 -Compress

    $url = "https://api.vercel.com/v10/projects?teamId=$([Uri]::EscapeDataString($TeamId))"
    $project = Invoke-VercelApi -Method POST -Url $url -Body $body

    if ($ProductionBranch) {
        $patchBody = @{ productionBranch = $ProductionBranch } | ConvertTo-Json -Compress
        $patchUrl = "https://api.vercel.com/v9/projects/$([Uri]::EscapeDataString($project.id))?teamId=$([Uri]::EscapeDataString($TeamId))"
        Invoke-VercelApi -Method PATCH -Url $patchUrl -Body $patchBody | Out-Null
    }

    return $project
}

function Test-ShouldRun {
    param([string]$Target, [string]$Action)
    if ($Force) { return $true }
    return $PSCmdlet.ShouldProcess($Target, $Action)
}

Write-Host "=== Office Tracker -> Enterprise migration ===" -ForegroundColor Green
Write-Host "Destination team slug: $DestinationTeamSlug"

$teams = Get-Teams
$destTeam = $teams | Where-Object { $_.slug -eq $DestinationTeamSlug } | Select-Object -First 1
if (-not $destTeam) {
    $teamList = ($teams | ForEach-Object { $_.slug }) -join ", "
    throw "Team '$DestinationTeamSlug' not found. Available teams: $teamList"
}
Write-Host "Found destination team: $($destTeam.name) [$($destTeam.id)]" -ForegroundColor Green

$destProjects = Get-Projects -TeamId $destTeam.id
$existingOnDest = @($destProjects | Where-Object { $ProjectNames -contains $_.name })
if ($existingOnDest.Count -gt 0) {
    Write-Host "Already on Enterprise team:" -ForegroundColor Yellow
    $existingOnDest | ForEach-Object {
        $url = if ($_.targets.production.alias -and $_.targets.production.alias.Count -gt 0) {
            $_.targets.production.alias[0]
        } else {
            "https://$($_.name).vercel.app"
        }
        Write-Host "  $($_.name) -> $url"
    }
}

$personalProjects = Get-Projects
$sourceProjects = @($personalProjects | Where-Object { $ProjectNames -contains $_.name })
if ($sourceProjects.Count -eq 0) {
    Write-Host "No source projects found on personal scope (may already be transferred)." -ForegroundColor Yellow
} else {
    Write-Host "Source projects on personal/Hobby scope:" -ForegroundColor Cyan
    $sourceProjects | ForEach-Object { Write-Host "  $($_.name) [$($_.id)] team=$($_.accountId)" }
}

foreach ($projectName in $ProjectNames) {
    if ($destProjects | Where-Object { $_.name -eq $projectName }) {
        Write-Host "Skip $projectName - already exists on $($DestinationTeamSlug)" -ForegroundColor Green
        continue
    }

    $source = $sourceProjects | Where-Object { $_.name -eq $projectName } | Select-Object -First 1
    if ($source) {
        Write-Host "`n--- Transfer: $projectName ---" -ForegroundColor Yellow
        if (Test-ShouldRun -Target $projectName -Action "Transfer to $DestinationTeamSlug") {
            try {
                $sourceTeamId = $source.accountId
                $code = Start-ProjectTransfer -ProjectId $source.id -ProjectName $projectName -SourceTeamId $sourceTeamId
                Write-Host "  Transfer code: $code" -ForegroundColor Cyan
                Write-Host "  Claim URL: https://vercel.com/claim-deployment?code=$code" -ForegroundColor Cyan
                try {
                    Complete-ProjectTransfer -Code $code -DestinationTeamId $destTeam.id
                    Write-Host "  Transfer completed for $projectName" -ForegroundColor Green
                    continue
                } catch {
                    Write-Host "  Auto-complete failed (permissions?). Open claim URL in browser while logged into $DestinationTeamSlug." -ForegroundColor Yellow
                    Write-Host "  $_" -ForegroundColor DarkYellow
                }
            } catch {
                Write-Host "  Transfer request failed: $_" -ForegroundColor Red
            }
        }
    }

    Write-Host "`n--- Import on Enterprise: $projectName ---" -ForegroundColor Yellow
    $branch = $ProductionBranches[$projectName]
    if (Test-ShouldRun -Target $projectName -Action "Create on $DestinationTeamSlug (branch $branch)") {
        try {
            $created = New-EnterpriseProject -Name $projectName -TeamId $destTeam.id -ProductionBranch $branch
            Write-Host "  Created $projectName [$($created.id)] on Enterprise" -ForegroundColor Green
            Write-Host "  Next: link Vercel Storage Postgres + copy env vars from Hobby project in dashboard" -ForegroundColor Yellow
        } catch {
            Write-Host "  Create failed: $_" -ForegroundColor Red
        }
    }
}

Write-Host "`n=== Done ===" -ForegroundColor Green
$final = Get-Projects -TeamId $destTeam.id
$final | Where-Object { $ProjectNames -contains $_.name } | ForEach-Object {
    Write-Host "Enterprise project: $($_.name) [$($_.id)]"
}
Write-Host "Dashboard: https://vercel.com/$DestinationTeamSlug" -ForegroundColor Cyan
