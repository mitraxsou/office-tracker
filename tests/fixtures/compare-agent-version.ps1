$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "..\..\agent\lib\agent-download.ps1")
$garbage = ("0" * 260) + "1"
$result = Compare-AgentVersion $garbage "1.5.2"
if ($result -ge 0) {
    throw "Expected corrupt version to compare less than 1.5.2, got $result"
}
Write-Output "OK"
