$ErrorActionPreference = "Stop"
$snippet = @"
`$ApiUrl = 'https://office.example'
`$Token = 'test-token'
`$Silent = `$true
`$installDir = Join-Path `$env:TEMP ('OfficePulse-iex-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path `$installDir -Force | Out-Null
`$configPath = Join-Path `$installDir 'config.json'
function Get-InstallDir { `$installDir }
function Get-ConfigPath { `$configPath }
function Write-SetupLog { }
`$isFreshInstall = -not (Test-Path `$configPath)
if (-not `$ApiUrl -and `$env:OFFICEPULSE_SETUP_API_URL) { `$ApiUrl = [string]`$env:OFFICEPULSE_SETUP_API_URL }
if (-not `$Token -and `$env:OFFICEPULSE_SETUP_TOKEN) { `$Token = [string]`$env:OFFICEPULSE_SETUP_TOKEN }
if (`$isFreshInstall -and (-not `$ApiUrl -or -not `$Token)) { throw 'missing credentials after IEX' }
Write-Output 'OK'
"@
Invoke-Expression $snippet
Remove-Item $installDir -Recurse -Force -ErrorAction SilentlyContinue
