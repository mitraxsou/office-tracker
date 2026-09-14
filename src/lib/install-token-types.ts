export type InstallTokenForUser = {
  id: string;
  label: string | null;
  prefix: string;
  plainToken: string | null;
  setupCommand: string;
  installCommand: string;
  updateCommand: string;
  createdAt: string;
  status: "pending" | "bound";
  boundSerialNumber: string | null;
  /** Commands read the token from config.json on an already-installed laptop. */
  usesLocalConfig?: boolean;
};
