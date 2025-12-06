import { describe, expect, it } from "vitest";
import { fingerprintSchema, isValidFingerprint, validateFingerprint } from "./fingerprint";

const sampleDomain = (label: string) => ({
  archetype: `${label} Archetype`,
  summary: `${label} summary`,
  description: `${label} description`,
  axes: [{ key: `${label.toLowerCase()}-axis`, label: `${label} Axis`, value: 72 }],
  highlights: ["Consistent pacing"],
});

const baseFingerprint = {
  version: "1.0.0",
  createdAt: new Date().toISOString(),
  metaAxes: {
    voiceIntensity: 65,
    conceptualDepth: 58,
    narrativeStructureStrength: 70,
    visualDynamism: 55,
    productionPolish: 62,
  },
  perDomain: {
    voiceProfile: sampleDomain("Voice"),
    languageProfile: sampleDomain("Language"),
    narrativeProfile: sampleDomain("Narrative"),
    visualProfile: sampleDomain("Visual"),
    editingProfile: sampleDomain("Editing"),
    soundProfile: sampleDomain("Sound"),
  },
  overallArchetype: "Reflective Analyst",
};

describe("fingerprint schema", () => {
  it("accepts a valid fingerprint", () => {
    const validated = validateFingerprint(baseFingerprint);
    expect(validated.version).toBe("1.0.0");
    expect(validated.perDomain.voiceProfile.archetype).toContain("Voice");
  });

  it("rejects missing required sections with a helpful error", () => {
    const invalid = { ...baseFingerprint, metaAxes: undefined };
    expect(() => validateFingerprint(invalid)).toThrow(/metaAxes/);
  });

  it("flags invalid objects via isValidFingerprint", () => {
    const withBadVersion = { ...baseFingerprint, version: "0.9.0" };
    expect(isValidFingerprint(withBadVersion)).toBe(false);
    expect(isValidFingerprint(baseFingerprint)).toBe(true);
  });

  it("matches the zod schema inference", () => {
    const parsed = fingerprintSchema.parse(baseFingerprint);
    expect(parsed.perDomain.editingProfile.axes[0].value).toBeTypeOf("number");
  });
});
