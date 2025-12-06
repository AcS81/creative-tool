import { describe, expect, it } from "vitest";
import { fingerprintSchema, isValidFingerprint, validateFingerprint } from "./fingerprint";

const sampleDomain = (label: string) => ({
  primaryArchetype: `${label} Archetype`,
  secondaryArchetype: `Alt ${label} Archetype`,
  summaryText: `${label} summary`,
  scores: [{ key: `${label.toLowerCase()}-axis`, label: `${label} Axis`, value: 72 }],
  highlights: ["Consistent pacing"],
});

const baseFingerprint = {
  version: "1.1.0",
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
  supporting: {
    transcriptSegments: [{ startSeconds: 0, endSeconds: 10, text: "Intro" }],
    sceneSegments: [
      { startSeconds: 0, endSeconds: 10, label: "Intro", shortSummary: "Opening" },
    ],
    beats: [{ startSeconds: 0, endSeconds: 10, label: "Hook", devices: ["contrast"] }],
  },
};

describe("fingerprint schema", () => {
  it("accepts a valid fingerprint", () => {
    const validated = validateFingerprint(baseFingerprint);
    expect(validated.version).toBe("1.1.0");
    expect(validated.perDomain.voiceProfile.primaryArchetype).toContain("Voice");
  });

  it("rejects missing required sections with a helpful error", () => {
    const invalid = { ...baseFingerprint, metaAxes: undefined };
    expect(() => validateFingerprint(invalid)).toThrow(/metaAxes/);
  });

  it("flags invalid objects via isValidFingerprint", () => {
    const withBadVersion = { ...baseFingerprint, version: "1.0.0" };
    expect(isValidFingerprint(withBadVersion)).toBe(false);
    expect(isValidFingerprint(baseFingerprint)).toBe(true);
  });

  it("matches the zod schema inference", () => {
    const parsed = fingerprintSchema.parse(baseFingerprint);
    expect(parsed.perDomain.editingProfile.scores[0].value).toBeTypeOf("number");
  });

  it("throws descriptive error for unsupported version", () => {
    const legacy = { ...baseFingerprint, version: "1.0.0" };
    expect(() => validateFingerprint(legacy)).toThrow(/unsupported version 1.0.0/i);
  });
});
