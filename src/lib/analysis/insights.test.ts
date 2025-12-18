import { describe, expect, it } from "vitest";
import { generateInsights } from "./insights";
import { buildDefaultAdvancedMetrics } from "./fingerprint/defaults";
import { buildMockAdvancedMetrics } from "./fingerprint/mockAdvancedMetrics";
import type { VideoFingerprintJson } from "../types";

const sampleMeta = {
  voiceIntensity: 60,
  conceptualDepth: 55,
  narrativeStructureStrength: 50,
  visualDynamism: 45,
  productionPolish: 65,
};

const refs = [
  { ...sampleMeta, voiceIntensity: 40 },
  { ...sampleMeta, voiceIntensity: 50 },
  { ...sampleMeta, voiceIntensity: 70 },
  { ...sampleMeta, voiceIntensity: 80 },
];

const sampleFingerprint: VideoFingerprintJson = {
  version: "1.3.0",
  createdAt: new Date().toISOString(),
  ...buildDefaultAdvancedMetrics(),
  metaAxes: sampleMeta,
  perDomain: {
    voiceProfile: { primaryArchetype: "Voice", summaryText: "Voice", scores: [{ key: "voice.speaking_rate", label: "Speech pace", value: 60 }] },
    languageProfile: { primaryArchetype: "Lang", summaryText: "Lang", scores: [{ key: "language.concreteness", label: "Concreteness", value: 55 }] },
    narrativeProfile: { primaryArchetype: "Narr", summaryText: "Narr", scores: [{ key: "narrative.story_presence", label: "Story presence", value: 50 }] },
    visualProfile: { primaryArchetype: "Vis", summaryText: "Vis", scores: [{ key: "visual.environment_stability", label: "Env", value: 45 }] },
    editingProfile: { primaryArchetype: "Edit", summaryText: "Edit", scores: [{ key: "editing.cut_rate", label: "Cut rate", value: 55 }] },
    soundProfile: { primaryArchetype: "Sound", summaryText: "Sound", scores: [{ key: "sound.music_coverage", label: "Music", value: 65 }] },
  },
};

describe("generateInsights", () => {
  it("returns fallback when no references available", () => {
    const result = generateInsights(sampleMeta, []);
    expect(result.unusualnessInsights).toContain("Not enough reference data yet.");
    expect(result.bullets[0]).toMatch(/Not enough reference data/);
  });

  it("produces ranked insights with readable text", () => {
    const result = generateInsights(sampleMeta, refs, { fingerprint: sampleFingerprint });
    expect(result.bullets.length).toBeGreaterThan(0);
    expect(result.bullets.some((b) => /reference videos/i.test(b) || /alignment/i.test(b))).toBe(true);
    expect(result.strengthInsights.length).toBeGreaterThan(0);
  });

  it("skips unobserved axes when domain scores are zero", () => {
    const sparseFingerprint: VideoFingerprintJson = {
      ...sampleFingerprint,
      metaAxes: { ...sampleMeta, visualDynamism: 0 },
      perDomain: {
        ...sampleFingerprint.perDomain,
        visualProfile: { primaryArchetype: "Vis", summaryText: "Vis", scores: [{ key: "visual.environment_stability", label: "Env", value: 0 }] },
        editingProfile: { primaryArchetype: "Edit", summaryText: "Edit", scores: [{ key: "editing.cut_rate", label: "Cut rate", value: 0 }] },
      },
    };
    const result = generateInsights(sparseFingerprint.metaAxes, refs, { fingerprint: sparseFingerprint });
    expect(result.bullets.some((b) => b.toLowerCase().includes("visual"))).toBe(false);
  });

  it("includes advanced alignment/load bullets when present", () => {
    const mockMetrics = buildMockAdvancedMetrics(42);
    const enriched = {
      ...sampleFingerprint,
      ...mockMetrics,
      cognitiveLoad: {
        ...mockMetrics.cognitiveLoad,
        loadHighlights: {
          ...mockMetrics.cognitiveLoad.loadHighlights,
          spans: [{ startSeconds: 10, endSeconds: 12, value: 85, label: "dense moment" }],
        },
      },
      secondOrder: {
        ...mockMetrics.secondOrder,
        alignmentScore: { ...mockMetrics.secondOrder.alignmentScore, score: 20 },
      },
    };
    const result = generateInsights(sampleMeta, refs, { fingerprint: enriched });
    expect(result.bullets.some((b) => b.toLowerCase().includes("alignment"))).toBe(true);
    expect(result.bullets.some((b) => b.toLowerCase().includes("cognitive load"))).toBe(true);
  });
});
