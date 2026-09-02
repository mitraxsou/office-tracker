export const DEFAULT_ADMIN_USERS_PAGE_SIZE = 20;
export const MAX_ADMIN_USERS_PAGE_SIZE = 100;

export type AdminUsersListParams = {
  all: boolean;
  search: string;
  page: number;
  pageSize: number;
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
  return { all, search, page, pageSize };
}

export function buildUserSearchWhere(search: string) {
  const trimmed = search.trim();
  if (!trimmed) return {};
  return {
    OR: [
      { email: { contains: trimmed, mode: "insensitive" as const } },
      { name: { contains: trimmed, mode: "insensitive" as const } },
    ],
  };
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
