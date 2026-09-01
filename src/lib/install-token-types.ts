export type InstallTokenForUser = {
  id: string;
  label: string | null;
  prefix: string;
  plainToken: string;
  installCommand: string;
  createdAt: string;
  status: "pending" | "bound";
  boundSerialNumber: string | null;
};
