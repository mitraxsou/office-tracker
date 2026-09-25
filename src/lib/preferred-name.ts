const MAX_PREFERRED_NAME_LENGTH = 32;
const PREFERRED_NAME_PATTERN = /^[A-Za-z][A-Za-z\s'-]*$/;

/**
 * Normalize a greeting-only display name.
 * Empty / whitespace clears preferredName (falls back to legal name).
 * Returns null when cleared, or the trimmed value when valid.
 */
export function normalizePreferredName(raw: unknown): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw !== "string") {
    throw new Error("preferredName must be a string");
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > MAX_PREFERRED_NAME_LENGTH) {
    throw new Error(`preferredName must be ${MAX_PREFERRED_NAME_LENGTH} characters or fewer`);
  }
  if (!PREFERRED_NAME_PATTERN.test(trimmed)) {
    throw new Error(
      "preferredName may only use letters, spaces, apostrophes, and hyphens",
    );
  }
  return trimmed;
}
