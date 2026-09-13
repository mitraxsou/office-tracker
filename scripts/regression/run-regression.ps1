# Orchestrates regression: reset, automated vitest suite, scenario dry-runs.
param(
    [switch]$SkipDb,
    [switch]$SkipScenarios,
    [string]$ApiUrl,
    [string]$Token
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$RegressionDir = Join-Path $env:LOCALAPPDATA "OfficeTracker-Regression"

Push-Location $RepoRoot
try {
    Write-Host "=== Office Pulse regression ===" -ForegroundColor Cyan
    Write-Host ""

    if (-not $SkipDb) {
        Write-Host "[1/4] Reset regression state (local + DB dummy user)..." -ForegroundColor Yellow
        & "$PSScriptRoot\reset-regression-state.ps1" -All
    } else {
        Write-Host "[1/4] Skipping DB reset (-SkipDb)" -ForegroundColor DarkGray
        if (Test-Path $RegressionDir) {
            Remove-Item -LiteralPath $RegressionDir -Recurse -Force
        }
    }

    Write-Host ""
    Write-Host "[2/4] npm run test:regression..." -ForegroundColor Yellow
    npm run test:regression
    if ($LASTEXITCODE -ne 0) { throw "test:regression failed with exit $LASTEXITCODE" }

    if (-not $SkipScenarios) {
        if (-not $ApiUrl -or -not $Token) {
            Write-Host ""
            Write-Host "[3/4] Fetching regression token from DB..." -ForegroundColor Yellow
            $userJson = npm run prisma:env --silent -- tsx scripts/regression/create-regression-user.ts 2>&1 | Select-Object -Last 20
            $parsed = $userJson | ConvertFrom-Json
            if (-not $ApiUrl) { $ApiUrl = $parsed.apiUrl }
            if (-not $Token) { $Token = $parsed.token }
        }

        Write-Host ""
        Write-Host "[3/4] Scenario dry-runs (install: $RegressionDir)..." -ForegroundColor Yellow
        $scenarios = @("home_wifi", "office_arrival", "office_departure", "sleep_wake", "day_rollover")
        foreach ($scenario in $scenarios) {
            Write-Host ""
            Write-Host "--- $scenario ---" -ForegroundColor Cyan
            & "$PSScriptRoot\agent-scenario.ps1" -Scenario $scenario -DryRun -ApiUrl $ApiUrl -Token $Token
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "Scenario $scenario dry-run exited $LASTEXITCODE (network/config may be unavailable)"
            }
        }
    } else {
        Write-Host "[3/4] Skipping scenario dry-runs (-SkipScenarios)" -ForegroundColor DarkGray
    }

    Write-Host ""
    Write-Host "[4/4] Full npm test..." -ForegroundColor Yellow
    npm test
    if ($LASTEXITCODE -ne 0) { throw "npm test failed with exit $LASTEXITCODE" }

    Write-Host ""
    Write-Host "Regression complete." -ForegroundColor Green
} catch {
    Write-Host "Regression failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}
