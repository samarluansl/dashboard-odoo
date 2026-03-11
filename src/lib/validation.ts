/**
 * Input validation helpers for API routes.
 * Centralised to avoid duplication and ensure consistent security checks.
 */

/** Validate a date string is in YYYY-MM-DD format and represents a real date. */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  if (isNaN(d.getTime())) return false;
  // Verify the parsed date matches the input (catches Feb 30, etc.)
  const [y, m, day] = value.split('-').map(Number);
  return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m && d.getUTCDate() === day;
}

/** Validate a UUID v4 string. */
export function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Allowed user roles. */
export const VALID_ROLES = ['admin', 'manager', 'viewer'] as const;
export type ValidRole = typeof VALID_ROLES[number];

/** Validate a role string. */
export function isValidRole(value: string): value is ValidRole {
  return (VALID_ROLES as readonly string[]).includes(value);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Returns true if both strings are equal.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to avoid length-based timing leak
    // (though length difference itself leaks info, this is standard practice)
    let result = a.length ^ b.length;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ (b.charCodeAt(i % b.length) || 0);
    }
    return result === 0;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** Maximum allowed message length for chat input. */
export const MAX_CHAT_MESSAGE_LENGTH = 2000;

/** Maximum number of history messages to accept from client. */
export const MAX_CHAT_HISTORY_LENGTH = 20;

/** Sanitize a company name parameter — strip control characters and limit length. */
export function sanitizeCompanyParam(value: string): string {
  // Remove control characters and limit to 200 chars
  return value.replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 200);
}
