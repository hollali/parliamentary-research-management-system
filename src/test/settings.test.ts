import { describe, it, expect } from "vitest";
import {
  validateNotificationPrefs,
  PREF_TRIGGERS,
  DEFAULT_PREFS,
} from "../../server/lib/notificationPrefs.js";
import { deriveInitials, validatePhone, normaliseOptional } from "../../server/lib/profile.js";

const validPrefs = {
  pushNotifications: true,
  emailSummaries: false,
  emailNotifications: true,
  whatsappNotifications: false,
  triggers: {
    newAssignments: true,
    statusChanges: false,
    draftMentions: true,
    deadlineReminders: false,
  },
};

describe("validateNotificationPrefs", () => {
  it("accepts a well-formed payload", () => {
    const result = validateNotificationPrefs(validPrefs);
    expect(result.ok).toBe(true);
  });

  it("accepts a payload that omits triggers entirely", () => {
    const { triggers, ...flagsOnly } = validPrefs;
    expect(triggers).toBeDefined();
    expect(validateNotificationPrefs(flagsOnly).ok).toBe(true);
  });

  it("rejects non-object payloads", () => {
    expect(validateNotificationPrefs(null).ok).toBe(false);
    expect(validateNotificationPrefs("nope").ok).toBe(false);
    expect(validateNotificationPrefs([validPrefs]).ok).toBe(false);
  });

  it("rejects a missing channel flag", () => {
    const { emailSummaries, ...rest } = validPrefs;
    expect(validateNotificationPrefs(rest).ok).toBe(false);
  });

  it("rejects a non-boolean channel flag", () => {
    expect(validateNotificationPrefs({ ...validPrefs, pushNotifications: "yes" }).ok).toBe(false);
  });

  it("rejects an unknown trigger key instead of persisting it", () => {
    const result = validateNotificationPrefs({
      ...validPrefs,
      triggers: { ...validPrefs.triggers, rocketLaunch: true },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/triggers/i);
  });

  it("rejects a non-boolean trigger value", () => {
    expect(
      validateNotificationPrefs({
        ...validPrefs,
        triggers: { ...validPrefs.triggers, statusChanges: 1 },
      }).ok,
    ).toBe(false);
  });

  it("rejects a non-object triggers value", () => {
    expect(validateNotificationPrefs({ ...validPrefs, triggers: true }).ok).toBe(false);
  });

  it("rejects an oversized payload", () => {
    const bloated = { ...validPrefs, padding: "x".repeat(2000) };
    expect(validateNotificationPrefs(bloated).ok).toBe(false);
  });

  it("ships a default payload that passes its own validation", () => {
    expect(validateNotificationPrefs(DEFAULT_PREFS).ok).toBe(true);
  });

  it("covers every declared trigger in the defaults", () => {
    expect(Object.keys(DEFAULT_PREFS.triggers).sort()).toEqual([...PREF_TRIGGERS].sort());
  });
});

describe("deriveInitials", () => {
  it("derives initials from first and last name", () => {
    expect(deriveInitials("Jane", "Doe")).toBe("JD");
  });

  it("uses only the first letter of a multi-word last name", () => {
    expect(deriveInitials("Kwame", "Van Der Berg")).toBe("KV");
  });

  it("handles a single name", () => {
    expect(deriveInitials("Prince", "")).toBe("P");
  });

  it("falls back to ? for an empty name", () => {
    expect(deriveInitials("", "")).toBe("?");
  });

  it("never returns more than two characters", () => {
    expect(deriveInitials("Alphonsina", "Bartholomew").length).toBe(2);
  });
});

describe("validatePhone", () => {
  it("treats an empty value as optional", () => {
    expect(validatePhone("")).toBe("");
    expect(validatePhone("   ")).toBe("");
  });

  it("accepts an international number", () => {
    expect(validatePhone("+233 20 000 0000")).toBe("");
    expect(validatePhone("+1 (415) 555-0132")).toBe("");
  });

  it("rejects a number that is too short", () => {
    expect(validatePhone("+2331")).not.toBe("");
  });

  it("rejects letters and other junk", () => {
    expect(validatePhone("call me maybe")).not.toBe("");
    expect(validatePhone("1234abcd")).not.toBe("");
  });
});

describe("normaliseOptional", () => {
  it("trims values and converts empty strings to null", () => {
    expect(normaliseOptional("  Asawase  ")).toBe("Asawase");
    expect(normaliseOptional("   ")).toBeNull();
  });

  it("preserves an explicit null", () => {
    expect(normaliseOptional(null)).toBeNull();
  });
});
