export const DEFAULT_ADMIN_USERS_PAGE_SIZE = 20;
export const MAX_ADMIN_USERS_PAGE_SIZE = 100;

export type AdminUsersListParams = {
  all: boolean;
  search: string;
  page: number;
  pageSize: number;
  source?: "otp_self";
};

export function parseAdminUsersListParams(searchParams: URLSearchParams): AdminUsersListParams {
  const all = searchParams.get("all") === "true";
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const rawPageSize =
    Number.parseInt(
      searchParams.get("pageSize") ?? String(DEFAULT_ADMIN_USERS_PAGE_SIZE),
      10,
    ) || DEFAULT_ADMIN_USERS_PAGE_SIZE;
  const pageSize = Math.min(MAX_ADMIN_USERS_PAGE_SIZE, Math.max(1, rawPageSize));
  const source = searchParams.get("source") === "otp_self" ? "otp_self" : undefined;
  return { all, search, page, pageSize, source };
}

export function buildUserSearchWhere(search: string, source?: "otp_self") {
  const trimmed = search.trim();
  const filters: Record<string, unknown>[] = [];
  if (trimmed) {
    filters.push({
      OR: [
        { email: { contains: trimmed, mode: "insensitive" as const } },
        { name: { contains: trimmed, mode: "insensitive" as const } },
      ],
    });
  }
  if (source === "otp_self") {
    filters.push({ registrationSource: "otp_self" });
  }
  if (filters.length === 0) return {};
  if (filters.length === 1) return filters[0];
  return { AND: filters };
}

export const ADMIN_PROFILE_CHANGE_REQUIRES_APPROVAL =
  "Name and email changes require admin approval. Submit a profile change request instead.";

export function getAdminDirectProfileUpdateError(body: {
  name?: string;
  email?: string;
}): string | null {
  if (body.name !== undefined || body.email !== undefined) {
    return ADMIN_PROFILE_CHANGE_REQUIRES_APPROVAL;
  }
  return null;
}
