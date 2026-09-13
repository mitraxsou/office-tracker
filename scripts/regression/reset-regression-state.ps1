# Resets regression harness state. Never touches the production OfficeTracker install.
param(
    [switch]$LocalOnly,
    [switch]$DbOnly,
    [switch]$All,
    [string]$UserId
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$RegressionDir = Join-Path $env:LOCALAPPDATA "OfficeTracker-Regression"

function Reset-LocalRegressionState {
    if (Test-Path -LiteralPath $RegressionDir) {
        Remove-Item -LiteralPath $RegressionDir -Recurse -Force
        Write-Host "Removed local regression install: $RegressionDir"
    } else {
        Write-Host "No local regression install at $RegressionDir"
    }
}

function Reset-DbRegressionState {
    Push-Location $RepoRoot
    try {
        $output = npm run prisma:env --silent -- tsx scripts/regression/create-regression-user.ts 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "create-regression-user.ts failed: $output"
        }
        Write-Host $output
    } finally {
        Pop-Location
    }
}

if ($All) {
    $LocalOnly = $true
    $DbOnly = $true
}

if (-not $LocalOnly -and -not $DbOnly) {
    $LocalOnly = $true
    $DbOnly = $true
}

if ($LocalOnly) {
    Reset-LocalRegressionState
}

if ($DbOnly) {
    Reset-DbRegressionState
}

if ($UserId) {
    Write-Host "Note: UserId parameter is reserved; DB reset always scopes to regression.dummy@office-tracker.test"
}

Write-Host "Regression state reset complete."
