import { describe, expect, it } from "vitest";
import { fingerprintSchema, isValidFingerprint, validateFingerprint } from "./fingerprint";
import { buildDefaultAdvancedMetrics } from "../analysis/fingerprint/defaults";

const sampleDomain = (label: string) => ({
  primaryArchetype: `${label} Archetype`,
  secondaryArchetype: `Alt ${label} Archetype`,
  summaryText: `${label} summary`,
  scores: [{ key: `${label.toLowerCase()}-axis`, label: `${label} Axis`, value: 72 }],
  highlights: ["Consistent pacing"],
});

const baseFingerprint = {
  version: "1.3.0",
  createdAt: new Date().toISOString(),
  ...buildDefaultAdvancedMetrics(),
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
    expect(validated.version).toBe("1.3.0");
    expect(validated.perDomain.voiceProfile.primaryArchetype).toContain("Voice");
    expect(validated.hasPerformanceData).toBe(false);
  });

  it("rejects missing required sections with a helpful error", () => {
    const invalid = { ...baseFingerprint, metaAxes: undefined };
    expect(() => validateFingerprint(invalid)).toThrow(/metaAxes/);
  });

  it("requires advanced metrics sections", () => {
    const invalid = { ...baseFingerprint };
    // @ts-expect-error intentional removal
    delete invalid.prosodyArc;
    expect(() => validateFingerprint(invalid)).toThrow(/prosodyArc/);
  });

  it("flags invalid objects via isValidFingerprint", () => {
    const withBadVersion = { ...baseFingerprint, version: "1.0.0" };
    const legacy = { ...baseFingerprint, version: "1.2.0" };
    expect(isValidFingerprint(withBadVersion)).toBe(false);
    expect(isValidFingerprint(legacy)).toBe(true);
    expect(isValidFingerprint(baseFingerprint)).toBe(true);
  });

  it("matches the zod schema inference", () => {
    const parsed = fingerprintSchema.parse(baseFingerprint);
    expect(parsed.perDomain.editingProfile.scores[0].value).toBeTypeOf("number");
  });

  it("upgrades legacy v1.1 fingerprints to v2", () => {
    const legacy = { ...baseFingerprint, version: "1.1.0" };
    const upgraded = validateFingerprint(legacy);
    expect(upgraded.version).toBe("1.3.0");
    expect(upgraded.hasPerformanceData).toBe(false);
    expect(upgraded.cognitiveLoad.loadPerSecond.observed).toBe(false);
  });

  it("upgrades legacy v1.2 fingerprints and fills advanced metrics", () => {
    const legacyV12 = { ...baseFingerprint, version: "1.2.0" };
    const upgraded = validateFingerprint(legacyV12);
    expect(upgraded.version).toBe("1.3.0");
    expect(upgraded.secondOrder.alignmentScore.score).toBe(0);
    expect(upgraded.modalityBalance.modalityOverReliance.value).toBe("unobserved");
  });

  it("throws descriptive error for unsupported version", () => {
    const legacy = { ...baseFingerprint, version: "1.0.0" };
    expect(() => validateFingerprint(legacy)).toThrow(/Invalid fingerprint/);
  });

  it("accepts an optional performance profile", () => {
    const withPerformance = {
      ...baseFingerprint,
      hasPerformanceData: true,
      performanceProfile: {
        scores: {
          hookRetention: 72,
          midVideoRetentionStability: 64,
          lateDropOffSeverity: 35,
          clickThroughRateQuality: 55,
        },
        metrics: {
          views: 120000,
          likes: 4500,
          comments: 320,
          ctr: 8.5,
          avgViewDurationSeconds: 320,
          retentionSeries: [
            { timeRatio: 0, audienceRetention: 100 },
            { timeRatio: 0.5, audienceRetention: 64 },
            { timeRatio: 1, audienceRetention: 42 },
          ],
        },
        summaryText: "Solid early retention with mild late drop-off.",
        insights: ["Hook retention is above average for similar channels."],
      },
    };
    const validated = validateFingerprint(withPerformance);
    expect(validated.performanceProfile?.metrics.retentionSeries?.length).toBe(3);
    expect(validated.performanceProfile?.scores.hookRetention).toBe(72);
    expect(validated.hasPerformanceData).toBe(true);
  });

  it("rejects performance profiles with invalid retention points", () => {
    const bad = {
      ...baseFingerprint,
      performanceProfile: {
        scores: {
          hookRetention: 72,
          midVideoRetentionStability: 64,
          lateDropOffSeverity: 35,
          clickThroughRateQuality: 55,
        },
        metrics: {
          retentionSeries: [{ timeRatio: 1.2, audienceRetention: 50 }],
        },
        summaryText: "Invalid retention point",
      },
    };
    expect(() => validateFingerprint(bad)).toThrow(/timeRatio/);
  });
});
