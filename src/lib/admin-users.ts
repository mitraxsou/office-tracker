import {
  getProfileChangeBlockReason,
  isPwcEmail,
  normalizeProfileEmail,
} from "./profile-change-requests";

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

const MAX_NAME_LENGTH = 120;

function normalizeName(name: string | null | undefined): string | null {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_NAME_LENGTH);
}

export function validateAdminDirectProfileUpdate(params: {
  currentName: string | null;
  currentEmail: string;
  name?: string;
  email?: string;
}): { error: string } | { updates: { name?: string | null; email?: string } } {
  const blockReason = getProfileChangeBlockReason(params.currentEmail);
  if (blockReason) {
    return { error: blockReason };
  }

  const updates: { name?: string | null; email?: string } = {};

  if (params.name !== undefined) {
    const normalized = normalizeName(params.name);
    const currentName = normalizeName(params.currentName);
    if (normalized !== currentName) {
      updates.name = normalized;
    }
  }

  if (params.email !== undefined) {
    const normalized = normalizeProfileEmail(params.email);
    const currentEmail = normalizeProfileEmail(params.currentEmail);
    if (!isPwcEmail(normalized)) {
      return {
        error: "Email must be a PwC address (for example user@pwc.com or user@uk.pwc.com)",
      };
    }
    if (normalized !== currentEmail) {
      updates.email = normalized;
    }
  }

  if (Object.keys(updates).length === 0) {
    return { error: "No profile changes to apply" };
  }

  return { updates };
}
