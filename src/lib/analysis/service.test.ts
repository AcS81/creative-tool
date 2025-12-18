import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeVideo } from "./service";
import type { DomainProfile } from "../types";
import type { AppConfig } from "../config";
import { ConfigError } from "../config";
import { buildDefaultAdvancedMetrics } from "./fingerprint/defaults";

const mockAnalyzeVideoMultimodal = vi.fn();

vi.mock("./geminiMultimodalAnalyzer", () => ({
  analyzeVideoMultimodal: (...args: any[]) => mockAnalyzeVideoMultimodal(...args),
}));

function mockDomain(label: string, base: number): DomainProfile {
  return {
    primaryArchetype: `${label} Archetype`,
    summaryText: `${label} summary`,
    scores: [
      { key: `${label}-a`, label: `${label} A`, value: base },
      { key: `${label}-b`, label: `${label} B`, value: base + 5 },
      { key: `${label}-c`, label: `${label} C`, value: base + 10 },
    ],
    highlights: [`${label} highlight`],
  };
}

const baseConfig: AppConfig = {
  analysisMode: "gemini",
  analysisVersion: "v2",
  analysisV2MultimodalEnabled: true,
  geminiApiKey: "key",
  youtubeApiKey: "yt",
  performanceEnabled: false,
  advancedMetricsEnabled: true,
};

describe("analyzeVideo service", () => {
  beforeEach(() => {
    mockAnalyzeVideoMultimodal.mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  const setupMultimodal = () => {
    mockAnalyzeVideoMultimodal.mockResolvedValue({
      profiles: {
        voice: mockDomain("Voice", 60),
        language: mockDomain("Language", 65),
        narrative: mockDomain("Narrative", 70),
        visual: mockDomain("Visual", 55),
        editing: mockDomain("Editing", 62),
        sound: mockDomain("Sound", 58),
      },
      beats: [{ startSeconds: 0, endSeconds: 10, label: "hook", devices: [] }],
      axisDetails: {},
      diagnostics: {
        fromFallback: false,
        unobservedCounts: { voice: 0, language: 0, narrative: 0, visual_edit_sound: 0 },
      },
    });
  };

  it("returns a valid fingerprint with multimodal analysis", async () => {
    setupMultimodal();

    const result = await analyzeVideo({ videoId: "abc123" }, { config: baseConfig });
    expect(result.fingerprint.version).toBe("1.3.0");
    expect(result.fingerprint.perDomain.voiceProfile.scores.length).toBeGreaterThan(0);
    expect(result.fingerprint.supporting?.beats?.length).toBe(1);
    expect(result.diagnostics?.source).toBe("gemini-v2-multimodal");
    expect(result.diagnostics?.analysisVersion).toBe("v2");
    expect(result.diagnostics?.advancedMetricsDefaulted).toBe(true);
    expect(result.diagnostics?.advancedMetricsObserved).toBe(false);
    expect(result.diagnostics?.advancedMetricsDefaultReason).toContain("unavailable");
    expect(result.diagnostics?.lowerConfidence).toBe(false);
  });

  it("surfaces fallback diagnostics when fallback media path is used", async () => {
    mockAnalyzeVideoMultimodal.mockResolvedValue({
      profiles: {
        voice: mockDomain("Voice", 60),
        language: mockDomain("Language", 65),
        narrative: mockDomain("Narrative", 70),
        visual: mockDomain("Visual", 55),
        editing: mockDomain("Editing", 62),
        sound: mockDomain("Sound", 58),
      },
      beats: [],
      axisDetails: {},
      diagnostics: {
        fromFallback: true,
        unobservedCounts: { voice: 1, language: 0, narrative: 0, visual_edit_sound: 2 },
      },
    });

    const result = await analyzeVideo({ videoId: "abc-fallback" }, { config: baseConfig });
    expect(result.diagnostics?.multimodalFallbackUsed).toBe(true);
    expect(result.diagnostics?.unobservedCounts?.voice).toBe(1);
    expect(result.diagnostics?.source).toBe("gemini-v2-multimodal");
    expect(result.diagnostics?.lowerConfidence).toBe(true);
    expect(result.diagnostics?.lowerConfidenceReason).toContain("fallback");
  });

  it("surfaces rollback diagnostics when advanced metrics are disabled", async () => {
    setupMultimodal();

    const result = await analyzeVideo(
      { videoId: "abc-disabled" },
      { config: { ...baseConfig, advancedMetricsEnabled: false } },
    );

    expect(result.diagnostics?.advancedMetricsDefaulted).toBe(true);
    expect(result.diagnostics?.advancedMetricsObserved).toBe(false);
    expect(result.diagnostics?.advancedMetricsDefaultReason).toContain("disabled");
  });

  it("propagates advanced metrics when Gemini returns them", async () => {
    const advancedMetrics = buildDefaultAdvancedMetrics();
    advancedMetrics.prosodyArc.paceMeanWpm = {
      ...advancedMetrics.prosodyArc.paceMeanWpm,
      score: 12,
      value: "180 wpm",
      observed: true,
      timeline: [{ timeSeconds: 0, value: 12 }],
    };

    mockAnalyzeVideoMultimodal.mockResolvedValue({
      profiles: {
        voice: mockDomain("Voice", 60),
        language: mockDomain("Language", 65),
        narrative: mockDomain("Narrative", 70),
        visual: mockDomain("Visual", 55),
        editing: mockDomain("Editing", 62),
        sound: mockDomain("Sound", 58),
      },
      beats: [{ startSeconds: 0, endSeconds: 10, label: "hook", devices: [] }],
      axisDetails: {},
      diagnostics: {
        fromFallback: false,
        unobservedCounts: { voice: 0, language: 0, narrative: 0, visual_edit_sound: 0 },
      },
      advancedMetrics,
    });

    const result = await analyzeVideo({ videoId: "abc-advanced" }, { config: baseConfig });
    expect(result.diagnostics?.advancedMetricsObserved).toBe(true);
    expect(result.diagnostics?.advancedMetricsDefaulted).toBe(false);
    expect(result.fingerprint.prosodyArc.paceMeanWpm.value).toBe("180 wpm");
    expect(result.fingerprint.prosodyArc.paceMeanWpm.observed).toBe(true);
  });

  it("throws when v1 is requested after decommissioning", async () => {
    const config: AppConfig = { ...baseConfig, analysisVersion: "v1", analysisV2MultimodalEnabled: false };
    await expect(analyzeVideo({ videoId: "abc-text" }, { config })).rejects.toBeInstanceOf(ConfigError);
  });

  it("falls back to mock analysis when ANALYSIS_MODE=mock", async () => {
    const result = await analyzeVideo(
      { videoId: "mock-video" },
      { config: { ...baseConfig, analysisMode: "mock" } },
    );
    expect(result.diagnostics?.source).toBe("mock");
    expect(result.fingerprint.version).toBe("1.3.0");
  });
});
