export type InstallTokenForUser = {
  id: string;
  label: string | null;
  prefix: string;
  plainToken: string;
  installCommand: string;
  updateCommand: string;
  createdAt: string;
  status: "pending" | "bound";
  boundSerialNumber: string | null;
};
