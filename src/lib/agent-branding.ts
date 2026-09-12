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

/** Relative scripts; copy commands assume PowerShell cwd is the extract folder. */
export const AGENT_RELATIVE_INSTALL_SCRIPT = ".\\install.ps1";
export const AGENT_RELATIVE_UPDATE_SCRIPT = ".\\update.ps1";
export const AGENT_RELATIVE_SETUP_SCRIPT = ".\\setup.ps1";

function buildRelativeScriptCommand(scriptPath: string, appUrl: string, token: string) {
  return `Unblock-File -LiteralPath "${scriptPath}"; powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}" -ApiUrl "${appUrl}" -Token "${token}"`;
}

/** Install command to paste after Open PowerShell here in the folder that contains install.ps1. */
export function buildInstallCommand(appUrl: string, token: string) {
  return buildRelativeScriptCommand(AGENT_RELATIVE_INSTALL_SCRIPT, appUrl, token);
}

/** Update command to paste from the same extract folder (update.ps1 -ApiUrl -Token). */
export function buildUpdateCommand(appUrl: string, token: string) {
  return buildRelativeScriptCommand(AGENT_RELATIVE_UPDATE_SCRIPT, appUrl, token);
}

/** Unified setup command (install or update, no zip). Preferred for new agent v1.3. */
export function buildSetupCommand(appUrl: string, token: string) {
  return buildRelativeScriptCommand(AGENT_RELATIVE_SETUP_SCRIPT, appUrl, token);
}

const AGENT_LOCAL_CONFIG_PS = `$env:LOCALAPPDATA\\${AGENT_INSTALL_FOLDER}\\config.json`;

/** Install command for laptops that already have the agent token in local config.json. */
export function buildInstallCommandFromLocalConfig(appUrl: string) {
  return `Unblock-File -LiteralPath "${AGENT_RELATIVE_INSTALL_SCRIPT}"; $cfg = Get-Content "${AGENT_LOCAL_CONFIG_PS}" -Raw | ConvertFrom-Json; powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${AGENT_RELATIVE_INSTALL_SCRIPT}" -ApiUrl "${appUrl}" -Token $cfg.token`;
}

/** Update command for laptops that already have the agent token in local config.json. */
export function buildUpdateCommandFromLocalConfig(appUrl: string) {
  return `Unblock-File -LiteralPath "${AGENT_RELATIVE_UPDATE_SCRIPT}"; $cfg = Get-Content "${AGENT_LOCAL_CONFIG_PS}" -Raw | ConvertFrom-Json; powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${AGENT_RELATIVE_UPDATE_SCRIPT}" -ApiUrl "${appUrl}" -Token $cfg.token`;
}

/**
 * Point an already-installed agent at a new server URL (e.g. Enterprise prod).
 * Keeps the existing token; does not download scripts. Run in any PowerShell window.
 */
export function buildRetargetApiUrlCommand(appUrl: string) {
  return `$p = Join-Path $env:LOCALAPPDATA "${AGENT_INSTALL_FOLDER}\\config.json"; if (-not (Test-Path -LiteralPath $p)) { throw "Agent not installed. Use Install (first time) instead." }; $cfg = Get-Content -LiteralPath $p -Raw | ConvertFrom-Json; $cfg.apiUrl = "${appUrl}"; $cfg | ConvertTo-Json | Set-Content -LiteralPath $p -Encoding UTF8; Write-Host "Server URL updated to ${appUrl}. Heartbeats will use it within ~2 min."`;
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
