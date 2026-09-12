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
    `$d=Join-Path $env:TEMP (''OfficePulse-''+[guid]::NewGuid().ToString(''N'')); ` +
    `New-Item -ItemType Directory -Path $d -Force | Out-Null; ` +
    `$h=@{Authorization=(''Bearer ''+$Token)}; ` +
    `$lib=Join-Path $d ''lib''; New-Item -ItemType Directory -Path $lib -Force | Out-Null; ` +
    `Invoke-WebRequest -Uri ($ApiUrl+''/api/agent/files/agent-download.ps1'') -Headers $h -OutFile (Join-Path $lib ''agent-download.ps1'') -UseBasicParsing; ` +
    `. (Join-Path $lib ''agent-download.ps1''); ` +
    `Invoke-WebRequest -Uri ($ApiUrl+''/api/agent/files/setup.ps1'') -Headers $h -OutFile (Join-Path $d ''setup.ps1'') -UseBasicParsing; ` +
    `$PSScriptRoot=$d; ` +
    `$t=Publish-AgentScriptTxt -Ps1Path (Join-Path $d ''setup.ps1''); ` +
    `$s=Get-Content -Raw $t; Invoke-Expression $s }'`
  );
}

/** Run a local script via IEX bypass (zip extract folder). */
function buildLocalIexCommand(scriptPath: string, appUrl: string, tokenExpr: string) {
  const base = escapePsSingleQuoted(trimTrailingSlash(appUrl));
  return (
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "& { $ErrorActionPreference='Stop'; ` +
    `. .\\lib\\agent-download.ps1; ` +
    `$ApiUrl='${base}'; $Token=${tokenExpr}; ` +
    `$PSScriptRoot=(Split-Path (Resolve-Path '${scriptPath}') -Parent); ` +
    `$t=Publish-AgentScriptTxt -Ps1Path (Resolve-Path '${scriptPath}'); ` +
    `$s=Get-Content -Raw $t; Invoke-Expression $s }"`
  );
}

/** Install command to paste after Open PowerShell here in the folder that contains install.ps1. */
export function buildInstallCommand(appUrl: string, token: string) {
  return buildLocalIexCommand(AGENT_RELATIVE_SETUP_SCRIPT, appUrl, `'${escapePsSingleQuoted(token)}'`);
}

/** Update command to paste from the same extract folder (update.ps1 -ApiUrl -Token). */
export function buildUpdateCommand(appUrl: string, token: string) {
  return buildLocalIexCommand(AGENT_RELATIVE_SETUP_SCRIPT, appUrl, `'${escapePsSingleQuoted(token)}'`);
}

/** Unified setup command (install or update, no zip). Preferred for new agent v1.3. */
export function buildSetupCommand(appUrl: string, token: string) {
  return buildServerBootstrapCommand(appUrl, `$Token=''${escapePsSingleQuoted(token)}''`);
}

/** Setup command for laptops that already have the agent token in local config.json. */
export function buildSetupCommandFromLocalConfig(appUrl: string) {
  const tokenSetup =
    `$cfg = Get-Content (Join-Path $env:LOCALAPPDATA ''${AGENT_INSTALL_FOLDER}\\config.json'') -Raw | ConvertFrom-Json; $Token = [string]$cfg.token`;
  return buildServerBootstrapCommand(appUrl, tokenSetup);
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

/**
 * Point an already-installed agent at a new server URL (e.g. Enterprise prod).
 * Keeps the existing token; does not download scripts. Run in any PowerShell window.
 */
export function buildRetargetApiUrlCommand(appUrl: string) {
  return `$p = Join-Path $env:LOCALAPPDATA "${AGENT_INSTALL_FOLDER}\\config.json"; if (-not (Test-Path -LiteralPath $p)) { throw "Agent not installed. Use Install (first time) instead." }; $cfg = Get-Content -LiteralPath $p -Raw | ConvertFrom-Json; $cfg.apiUrl = "${appUrl}"; $cfg | ConvertTo-Json | Set-Content -LiteralPath $p -Encoding UTF8; Write-Host "Server URL updated to ${appUrl}. Agent will sync within ~2 min."`;
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
