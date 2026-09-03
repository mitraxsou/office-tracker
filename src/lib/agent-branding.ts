/** User-facing product name for PwC Office Pulse agent */
export const AGENT_PRODUCT_NAME = "PwC Office Pulse";

/** Windows Task Scheduler task name (no spaces, schtasks-safe) */
export const AGENT_TASK_NAME = "PwCOfficePulse";

/** Legacy task names removed on install/uninstall */
export const LEGACY_TASK_NAMES = ["OfficeTrackerHeartbeat", "PwCOfficePulse"];

/** Installed agent folder on laptop */
export const AGENT_INSTALL_FOLDER = "OfficeTracker";

export const AGENT_INSTALL_DIR = `%LOCALAPPDATA%\\${AGENT_INSTALL_FOLDER}`;

/** Startup shortcut filename */
export const AGENT_STARTUP_SHORTCUT = "PwC Office Pulse.lnk";

/** Legacy startup shortcuts removed on uninstall */
export const LEGACY_STARTUP_SHORTCUTS = ["OfficeTrackerHeartbeat.lnk", "PwC Office Pulse.lnk"];

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
