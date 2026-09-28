/**
 * Notification preference validation.
 *
 * Preferences are persisted as a JSON column, so without a whitelist an unknown
 * or mistyped key can be written straight into the database and a partial
 * `triggers` object would silently wipe the member's other triggers.
 */

export const PREF_FLAGS = [
  "pushNotifications",
  "emailSummaries",
  "emailNotifications",
  "whatsappNotifications",
] as const;

export const PREF_TRIGGERS = [
  "newAssignments",
  "statusChanges",
  "draftMentions",
  "deadlineReminders",
] as const;

export const DEFAULT_PREFS = {
  pushNotifications: true,
  emailSummaries: true,
  emailNotifications: true,
  whatsappNotifications: false,
  triggers: {
    newAssignments: true,
    statusChanges: true,
    draftMentions: true,
    deadlineReminders: true,
  },
};

export const MAX_PREFS_PAYLOAD = 1024;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True only when every own key is expected and every value is a boolean. */
function isBooleanRecord(value: unknown, keys: readonly string[]): boolean {
  if (!isPlainObject(value)) return false;
  if (Object.keys(value).some((key) => !keys.includes(key))) return false;
  return Object.values(value).every((entry) => typeof entry === "boolean");
}

export type PrefsValidation =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Validates a preferences payload. `triggers` is optional so a caller can update
 * only the channel toggles, but when present it must be a complete, key-safe
 * boolean record.
 */
export function validateNotificationPrefs(prefs: unknown): PrefsValidation {
  if (!isPlainObject(prefs)) {
    return { ok: false, error: "Invalid notification preferences" };
  }
  if (PREF_FLAGS.some((key) => typeof prefs[key] !== "boolean")) {
    return { ok: false, error: "Invalid notification preferences" };
  }
  if (prefs.triggers !== undefined && !isBooleanRecord(prefs.triggers, PREF_TRIGGERS)) {
    return { ok: false, error: "Invalid notification triggers" };
  }
  if (JSON.stringify(prefs).length > MAX_PREFS_PAYLOAD) {
    return { ok: false, error: "Preferences payload too large" };
  }
  return { ok: true, value: prefs };
}
