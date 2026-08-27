/** User-facing product name for PwC Office Pulse agent */
export const AGENT_PRODUCT_NAME = "PwC Office Pulse";

/** Windows Task Scheduler task name (no spaces — schtasks-safe) */
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

/** Default folder after downloading agent zip from Settings */
export const AGENT_DOWNLOAD_FOLDER = `%USERPROFILE%\\Downloads\\PwCOfficePulse`;

export function buildInstallCommand(appUrl: string, token: string, installScriptDir: string) {
  const scriptPath = `${installScriptDir}\\install.ps1`.replace(/\\\\/g, "\\");
  return `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -ApiUrl "${appUrl}" -Token "${token}"`;
}

export function buildUninstallCommand(installScriptDir: string) {
  const scriptPath = `${installScriptDir}\\uninstall.ps1`.replace(/\\\\/g, "\\");
  return `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`;
}

/** Resolved download path for install commands (after extracting zip) */
export function defaultAgentExtractPath() {
  return process.env.AGENT_DOWNLOAD_PATH || "C:\\Users\\%USERNAME%\\Downloads\\PwCOfficePulse";
}
