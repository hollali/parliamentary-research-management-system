/**
 * Profile field helpers shared by the profile update route.
 */

const PHONE_PATTERN = /^\+?[0-9][0-9\s()-]{6,19}$/;

/**
 * Initials are denormalised onto the user row and used for avatars, so they must
 * be rebuilt whenever the name changes. Falls back to "?" rather than an empty
 * string so an avatar never renders blank.
 */
export function deriveInitials(firstName: string, lastName: string): string {
  const initials = [firstName, lastName]
    .map((part) => part.trim()[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return initials || "?";
}

/** Returns an error message, or an empty string when the number is acceptable. */
export function validatePhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  if (!PHONE_PATTERN.test(trimmed)) {
    return "Enter a valid phone number, including country code";
  }
  return "";
}

/** Normalises a user-supplied optional string to a trimmed value or null. */
export function normaliseOptional(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}
