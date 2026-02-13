export const LIMITS = {
  TITLE: 255,
  DESCRIPTION: 2000,
  CARD_TITLE: 25,
  CARD_DESCRIPTION: 40,
  TIER_NAME: 255,
  COLUMN_NAME: 255,
  COLOR: 7,
  IMAGE_URL: 2000,
  NICKNAME: 255,
  MAX_TIERS: 20,
  MAX_COLUMNS: 20,
  MAX_CARDS: 500,
  PAGINATION_LIMIT: 100,
};

export function validateString(
  value: unknown,
  maxLength: number,
  fieldName: string,
): { valid: true; value: string } | { valid: false; error: string } {
  if (value === null || value === undefined) {
    return { valid: true, value: "" };
  }
  if (typeof value !== "string") {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  if (value.length > maxLength) {
    return { valid: false, error: `${fieldName} must be at most ${maxLength} characters` };
  }
  return { valid: true, value };
}

export function validateOptionalString(
  value: unknown,
  maxLength: number,
  fieldName: string,
): { valid: true; value: string | null } | { valid: false; error: string } {
  if (value === null || value === undefined || value === "") {
    return { valid: true, value: null };
  }
  if (typeof value !== "string") {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  if (value.length > maxLength) {
    return { valid: false, error: `${fieldName} must be at most ${maxLength} characters` };
  }
  return { valid: true, value };
}

export function validateArrayLength<T>(
  arr: T[] | undefined,
  maxLength: number,
  fieldName: string,
): { valid: true } | { valid: false; error: string } {
  if (!arr) return { valid: true };
  if (arr.length > maxLength) {
    return { valid: false, error: `${fieldName} must have at most ${maxLength} items` };
  }
  return { valid: true };
}

export function clampPaginationLimit(limit: number): number {
  return Math.max(1, Math.min(limit, LIMITS.PAGINATION_LIMIT));
}
