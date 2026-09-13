import { NextResponse } from "next/server";
import {
  getRemoteApiUrl,
  isDevSimulatorEnabled,
  isRemoteApiMode,
  listDemoUsers,
  loadDemoUsersFile,
  officeSsidOptions,
} from "@/lib/dev-simulator";

export async function GET() {
  if (!isDevSimulatorEnabled()) {
    return NextResponse.json({ error: "Simulator disabled" }, { status: 404 });
  }

  const file = loadDemoUsersFile();
  const users = listDemoUsers().map(({ token: _token, password: _password, ...rest }) => rest);

  return NextResponse.json({
    users,
    ssids: officeSsidOptions(),
    remoteApiMode: isRemoteApiMode(),
    remoteApiUrl: isRemoteApiMode() ? getRemoteApiUrl() : null,
    apiUrl: file?.apiUrl ?? null,
    hasDemoUsersFile: Boolean(file),
  });
}
