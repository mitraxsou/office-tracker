/** User-facing web app and agent product name */
export const APP_NAME = "My Office Pulse";

/** @deprecated Use APP_NAME */
export const AGENT_PRODUCT_NAME = APP_NAME;

/** Windows Task Scheduler task name (no spaces, schtasks-safe) */
export const AGENT_TASK_NAME = "PwCOfficePulse";

/** Legacy task names removed on install/uninstall */
export const LEGACY_TASK_NAMES = ["OfficeTrackerHeartbeat", "PwCOfficePulse"];

/** Installed agent folder on laptop */
export const AGENT_INSTALL_FOLDER = "OfficeTracker";

export const AGENT_INSTALL_DIR = `%LOCALAPPDATA%\\${AGENT_INSTALL_FOLDER}`;

/** Startup shortcut filename */
export const AGENT_STARTUP_SHORTCUT = "My Office Pulse.lnk";

/** Legacy startup shortcuts removed on uninstall */
export const LEGACY_STARTUP_SHORTCUTS = [
  "OfficeTrackerHeartbeat.lnk",
  "PwC Office Pulse.lnk",
  "My Office Pulse.lnk",
];

/** Default folder name inside the agent zip */
export const AGENT_EXTRACT_FOLDER = "PwCOfficePulse";

/** Downloaded zip filename (no .zip) - Extract All may nest this around AGENT_EXTRACT_FOLDER */
export const AGENT_ZIP_STEM = "PwCOfficePulse-agent";

/** Human-readable extract location for UI copy */
export const AGENT_DOWNLOAD_FOLDER = `%USERPROFILE%\\Downloads\\${AGENT_EXTRACT_FOLDER}`;

/** PowerShell path hint when the user must cd (OneDrive Downloads often differs) */
export const AGENT_EXTRACT_PATH_PS = `$env:USERPROFILE\\Downloads\\${AGENT_EXTRACT_FOLDER}`;

/** Relative scripts; zip-folder commands use IEX bypass (no -File on PwC laptops). */
export const AGENT_RELATIVE_INSTALL_SCRIPT = ".\\install.ps1";
export const AGENT_RELATIVE_UPDATE_SCRIPT = ".\\update.ps1";
export const AGENT_RELATIVE_SETUP_SCRIPT = ".\\setup.ps1";

function escapePsSingleQuoted(value: string) {
  return value.replace(/'/g, "''");
}

function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, "");
}

/** Download setup.ps1 from server and run via IEX. Works without zip on PwC laptops. */
function buildServerBootstrapCommand(appUrl: string, tokenSetup: string) {
  const base = escapePsSingleQuoted(trimTrailingSlash(appUrl));
  // Outer -Command uses single quotes so pasted command never needs \" inside strings.
  return (
    `powershell -NoProfile -ExecutionPolicy Bypass -Command '& { $ErrorActionPreference=''Stop''; ` +
    `[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; ` +
    `$ApiUrl=''${base}''; ${tokenSetup}; ` +
    `$env:OFFICEPULSE_SETUP_API_URL=$ApiUrl; $env:OFFICEPULSE_SETUP_TOKEN=$Token; ` +
    `$d=Join-Path $env:TEMP (''OfficePulse-''+[guid]::NewGuid().ToString(''N'')); ` +
    `New-Item -ItemType Directory -Path $d -Force | Out-Null; ` +
    `$h=@{Authorization=(''Bearer ''+$Token)}; ` +
    `$lib=Join-Path $d ''lib''; New-Item -ItemType Directory -Path $lib -Force | Out-Null; ` +
    `Invoke-WebRequest -Uri ($ApiUrl+''/api/agent/files/agent-download.ps1'') -Headers $h -OutFile (Join-Path $lib ''agent-download.ps1'') -UseBasicParsing; ` +
    `Invoke-WebRequest -Uri ($ApiUrl+''/api/agent/files/agent-storage.ps1'') -Headers $h -OutFile (Join-Path $lib ''agent-storage.ps1'') -UseBasicParsing; ` +
    `. (Join-Path $lib ''agent-download.ps1''); ` +
    `. (Join-Path $lib ''agent-storage.ps1''); ` +
    `Invoke-WebRequest -Uri ($ApiUrl+''/api/agent/files/setup.ps1'') -Headers $h -OutFile (Join-Path $d ''setup.ps1'') -UseBasicParsing; ` +
    `$PSScriptRoot=$d; ` +
    `$code = Invoke-AgentScriptBypass -Ps1Path (Join-Path $d ''setup.ps1'') -BoundVars @{ ApiUrl=$ApiUrl; Token=$Token } -Wait; ` +
    `if ($code -ne 0) { exit $code } }'`
  );
}

/** Run a local script via IEX bypass (zip extract folder). */
function buildLocalIexCommand(
  scriptPath: string,
  appUrl: string,
  tokenExpr: string,
  options?: { force?: boolean },
) {
  const base = escapePsSingleQuoted(trimTrailingSlash(appUrl));
  const forceBinding = options?.force ? "; Force = `$true" : "";
  return (
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "& { $ErrorActionPreference='Stop'; ` +
    `if (-not (Test-Path '.\\lib\\agent-download.ps1')) { Write-Host 'Open PowerShell in the folder that contains setup.ps1 (extracted zip).'; exit 1 }; ` +
    `. .\\lib\\agent-download.ps1; ` +
    `. .\\lib\\agent-storage.ps1; ` +
    `$ApiUrl='${base}'; $Token=${tokenExpr}; ` +
    `$env:OFFICEPULSE_SETUP_API_URL=$ApiUrl; $env:OFFICEPULSE_SETUP_TOKEN=$Token; ` +
    `$PSScriptRoot=(Split-Path (Resolve-Path '${scriptPath}') -Parent); ` +
    `$code = Invoke-AgentScriptBypass -Ps1Path (Resolve-Path '${scriptPath}') -BoundVars @{ ApiUrl='${base}'; Token=${tokenExpr}${forceBinding} } -Wait; ` +
    `if ($code -ne 0) { exit $code } }"`
  );
}

/** Zip folder: always refresh scripts from server (install, update, or fix a bad install). */
export function buildZipReinstallCommand(appUrl: string, token: string) {
  return buildLocalIexCommand(
    AGENT_RELATIVE_SETUP_SCRIPT,
    appUrl,
    `'${escapePsSingleQuoted(token)}'`,
    { force: true },
  );
}

export function buildZipReinstallCommandFromLocalConfig(appUrl: string) {
  const tokenExpr = `(Get-Content (Join-Path $env:LOCALAPPDATA '${AGENT_INSTALL_FOLDER}\\config.json') -Raw | ConvertFrom-Json).token`;
  return buildLocalIexCommand(AGENT_RELATIVE_SETUP_SCRIPT, appUrl, tokenExpr, { force: true });
}

/** @deprecated Same as buildZipReinstallCommand — use reinstall command from extracted zip. */
export function buildInstallCommand(appUrl: string, token: string) {
  return buildZipReinstallCommand(appUrl, token);
}

/** @deprecated Same as buildZipReinstallCommand. */
export function buildUpdateCommand(appUrl: string, token: string) {
  return buildZipReinstallCommand(appUrl, token);
}

/** Primary copy-paste command: run from extracted zip folder; installs latest agent from server. */
export function buildSetupCommand(appUrl: string, token: string) {
  return buildZipReinstallCommand(appUrl, token);
}

/** Download uninstall.ps1 from server and run (no zip). Auth uses Bearer token for /api/agent/files. */
function buildServerBootstrapUninstallCommand(appUrl: string, tokenSetup: string) {
  const base = escapePsSingleQuoted(trimTrailingSlash(appUrl));
  return (
    `powershell -NoProfile -ExecutionPolicy Bypass -Command '& { $ErrorActionPreference=''Stop''; ` +
    `[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; ` +
    `$ApiUrl=''${base}''; ${tokenSetup}; ` +
    `$d=Join-Path $env:TEMP (''OfficePulse-''+[guid]::NewGuid().ToString(''N'')); ` +
    `New-Item -ItemType Directory -Path $d -Force | Out-Null; ` +
    `$h=@{Authorization=(''Bearer ''+$Token)}; ` +
    `$u=Join-Path $d ''uninstall.ps1''; ` +
    `Invoke-WebRequest -Uri ($ApiUrl+''/api/agent/files/uninstall.ps1'') -Headers $h -OutFile $u -UseBasicParsing; ` +
    `$body = Get-Content -Raw $u; Invoke-Expression $body; ` +
    `if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'`
  );
}

export function buildBootstrapUninstallCommand(appUrl: string, token: string) {
  return buildServerBootstrapUninstallCommand(appUrl, `$Token=''${escapePsSingleQuoted(token)}''`);
}

export function buildBootstrapUninstallCommandFromLocalConfig(appUrl: string) {
  const tokenSetup =
    `$cfg = Get-Content (Join-Path $env:LOCALAPPDATA ''${AGENT_INSTALL_FOLDER}\\config.json'') -Raw | ConvertFrom-Json; $Token = [string]$cfg.token`;
  return buildServerBootstrapUninstallCommand(appUrl, tokenSetup);
}

/** Reinstall from zip when token is only in local config.json. */
export function buildSetupCommandFromLocalConfig(appUrl: string) {
  return buildZipReinstallCommandFromLocalConfig(appUrl);
}

const AGENT_LOCAL_CONFIG_PS = `$env:LOCALAPPDATA\\${AGENT_INSTALL_FOLDER}\\config.json`;

/** Install command for laptops that already have the agent token in local config.json. */
export function buildInstallCommandFromLocalConfig(appUrl: string) {
  return buildSetupCommandFromLocalConfig(appUrl);
}

/** Update command for laptops that already have the agent token in local config.json. */
export function buildUpdateCommandFromLocalConfig(appUrl: string) {
  return buildInstallCommandFromLocalConfig(appUrl);
}

/** Full-path install command (legacy / local dev with explicit script dir) */
export function buildInstallCommandWithPath(appUrl: string, token: string, installScriptDir: string) {
  const scriptPath = `${installScriptDir}\\install.ps1`.replace(/\\\\/g, "\\");
  return `Unblock-File -LiteralPath "${scriptPath}"; powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}" -ApiUrl "${appUrl}" -Token "${token}"`;
}

export function defaultInstallScriptDir(localDevPath?: string | null) {
  return localDevPath || AGENT_EXTRACT_PATH_PS;
}

export function buildUninstallCommand(installScriptDir?: string) {
  const scriptPath = installScriptDir
    ? `${installScriptDir}\\uninstall.ps1`.replace(/\\\\/g, "\\")
    : "uninstall.ps1";
  return `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`;
}

/** Resolved download path for install commands (after extracting zip) */
export function defaultAgentExtractPath() {
  return process.env.AGENT_DOWNLOAD_PATH || "C:\\Users\\%USERNAME%\\Downloads\\PwCOfficePulse";
}
