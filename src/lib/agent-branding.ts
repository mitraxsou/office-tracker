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

/** Default folder after extracting the agent zip (under Downloads) */
export const AGENT_EXTRACT_FOLDER = "PwCOfficePulse";

/** Human-readable extract location for UI copy */
export const AGENT_DOWNLOAD_FOLDER = `%USERPROFILE%\\Downloads\\${AGENT_EXTRACT_FOLDER}`;

/** PowerShell path for local dev install scripts */
export const AGENT_EXTRACT_PATH_PS = `$env:USERPROFILE\\Downloads\\${AGENT_EXTRACT_FOLDER}`;

/** Full-path install command for the extracted agent folder in Downloads. */
export function buildInstallCommand(appUrl: string, token: string) {
  return `powershell -ExecutionPolicy Bypass -File "${AGENT_EXTRACT_PATH_PS}\\install.ps1" -ApiUrl "${appUrl}" -Token "${token}"`;
}

/** Full-path install command (legacy / local dev with explicit script dir) */
export function buildInstallCommandWithPath(appUrl: string, token: string, installScriptDir: string) {
  const scriptPath = `${installScriptDir}\\install.ps1`.replace(/\\\\/g, "\\");
  return `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -ApiUrl "${appUrl}" -Token "${token}"`;
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
