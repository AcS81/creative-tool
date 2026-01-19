import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeVideo } from "./service";
import type { DomainProfile } from "../types";
import type { AppConfig } from "../config";
import { ConfigError } from "../config";
import { buildDefaultAdvancedMetrics } from "./fingerprint/defaults";
import type { ChapterCoreMetrics, SummaryMetric } from "./types/coreMetrics";

const mockAnalyzeVideoMultimodal = vi.fn();
const mockRunStructurePass = vi.fn();
const mockExecuteAdvancedPass = vi.fn();

vi.mock("./geminiMultimodalAnalyzer", () => ({
  analyzeVideoMultimodal: (...args: any[]) => mockAnalyzeVideoMultimodal(...args),
}));

vi.mock("./structurePass", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./structurePass")>();
  return {
    ...actual,
    runStructurePass: (...args: any[]) => mockRunStructurePass(...args),
  };
});

vi.mock("./advancedPass", () => ({
  executeAdvancedPass: (...args: any[]) => mockExecuteAdvancedPass(...args),
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

const metric = (value = "ok", score = 60, observed = true): SummaryMetric => ({
  score,
  value,
  observed,
});

const buildChapterMetrics = (chapterId: string): ChapterCoreMetrics => ({
  chapterId,
  voice: {
    speakingRate: metric(),
    fillerRate: metric(),
    pauseUsage: metric(),
    loudnessRange: metric(),
    pitchVariation: metric(),
    clarity: metric(),
    warmth: metric(),
  },
  language: {
    concreteness: metric(),
    metaphorDensity: metric(),
    references: metric(),
    humor: metric(),
    teachingVsRiffing: metric(),
    storyPresence: metric(),
  },
  narrative: {
    structureClarity: metric(),
    hookPresence: metric(),
    transitionQuality: metric(),
    payoffDelivery: metric(),
  },
  visual: {
    cutRate: metric(),
    environmentStability: metric(),
    movement: metric(),
    expression: metric(),
  },
  sound: {
    musicCoverage: metric(),
    musicBalance: metric(),
    sfxDensity: metric(),
    silenceUsage: metric(),
  },
});

const baseConfig: AppConfig = {
  analysisMode: "gemini",
  analysisVersion: "v2",
  analysisV2MultimodalEnabled: true,
  geminiApiKey: "key",
  youtubeApiKey: "yt",
  performanceEnabled: false,
  advancedMetricsEnabled: true,
  advancedMaxSegments: 5,
  advancedSegmentMaxSeconds: 120,
  advancedMaxTimelinePoints: 25,
  advancedMaxPassCostUsd: 0.25,
  advancedMaxPassDurationMs: 180000,
  structurePassEnabled: true,
  structurePassTimeoutMs: 30000,
  geminiResponseSchemaEnabled: false,
};

describe("analyzeVideo service", () => {
  beforeEach(() => {
    mockAnalyzeVideoMultimodal.mockReset();
    mockRunStructurePass.mockReset();
    mockExecuteAdvancedPass.mockReset();
    mockExecuteAdvancedPass.mockResolvedValue({
      segments: [],
      diagnostics: {
        segmentsPlanned: 0,
        segmentsCompleted: 0,
        segmentsFailed: 0,
        totalDurationMs: 0,
        estimatedCostUsd: 0,
      },
    });
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
        unobservedCounts: { voice: 0, language: 0, narrative: 0, visual_edit_sound: 0 },
      },
    });
  };

  const setupStructurePass = () => {
    mockRunStructurePass.mockResolvedValue({
      skeleton: {
        durationSeconds: 600,
        videoType: "tutorial",
        topicSummary: "Sample topic summary for tests. It covers the video overview.",
        chapters: [
          {
            id: "ch1",
            title: "Intro",
            startSeconds: 0,
            endSeconds: 60,
            summary: "Introduces the topic briefly.",
            chapterType: "intro",
          },
          {
            id: "ch2",
            title: "Body",
            startSeconds: 60,
            endSeconds: 600,
            summary: "Covers the main discussion points.",
            chapterType: "body",
          },
        ],
        keyMoments: [
          {
            type: "hook",
            timestamp: 5,
            chapterId: "ch1",
            description: "Promises clear outcomes quickly.",
          },
        ],
        contentMix: {
          talkingHeadPct: 60,
          brollPct: 20,
          graphicsPct: 10,
          screencastPct: 5,
          otherPct: 5,
        },
        analysisHints: {
          hasMusic: false,
          hasSFX: false,
          hasOnScreenText: true,
          hasMultipleSpeakers: false,
          primaryLanguage: "en",
          estimatedComplexity: "medium",
        },
      },
      source: "gemini",
    });
  };

  it("returns a valid fingerprint with multimodal analysis", async () => {
    setupMultimodal();
    setupStructurePass();

    const result = await analyzeVideo({ videoId: "abc123" }, { config: baseConfig });
    expect(result.fingerprint.version).toBe("1.3.0");
    expect(result.fingerprint.perDomain.voiceProfile.scores.length).toBeGreaterThan(0);
    expect(result.fingerprint.supporting?.beats?.length).toBe(1);
    expect(result.skeleton.durationSeconds).toBe(600);
    expect(result.diagnostics?.source).toBe("gemini-v2-multimodal");
    expect(result.diagnostics?.analysisVersion).toBe("v2");
    expect(result.diagnostics?.advancedMetricsDefaulted).toBe(true);
    expect(result.diagnostics?.advancedMetricsObserved).toBe(false);
    expect(result.diagnostics?.advancedMetricsDefaultReason).toContain("unavailable");
    expect(result.diagnostics?.structurePass?.success).toBe(true);
  });

  it("surfaces rollback diagnostics when advanced metrics are disabled", async () => {
    setupMultimodal();
    setupStructurePass();

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
        unobservedCounts: { voice: 0, language: 0, narrative: 0, visual_edit_sound: 0 },
      },
      advancedMetrics,
    });
    setupStructurePass();

    const result = await analyzeVideo({ videoId: "abc-advanced" }, { config: baseConfig });
    expect(result.diagnostics?.advancedMetricsObserved).toBe(true);
    expect(result.diagnostics?.advancedMetricsDefaulted).toBe(false);
    expect(result.fingerprint.prosodyArc.paceMeanWpm.value).toBe("180 wpm");
    expect(result.fingerprint.prosodyArc.paceMeanWpm.observed).toBe(true);
  });

  it("passes tiered analysis inputs and stores per-chapter metrics", async () => {
    setupStructurePass();
    mockAnalyzeVideoMultimodal.mockResolvedValue({
      profiles: {
        voice: mockDomain("Voice", 60),
        language: mockDomain("Language", 65),
        narrative: mockDomain("Narrative", 70),
        visual: mockDomain("Visual", 55),
        editing: mockDomain("Editing", 62),
        sound: mockDomain("Sound", 58),
      },
      axisDetails: {},
      perChapterMetrics: [buildChapterMetrics("ch1")],
      diagnostics: {
        unobservedCounts: { voice: 0, language: 0, narrative: 0, visual_edit_sound: 0 },
      },
    });

    const result = await analyzeVideo(
      { videoId: "abc-tiered" },
      { config: { ...baseConfig, useTieredAnalysis: true } },
    );

    expect(mockAnalyzeVideoMultimodal).toHaveBeenCalledWith(
      expect.objectContaining({
        useTieredAnalysis: true,
        skeleton: expect.any(Object),
      }),
    );
    expect(result.diagnostics?.analysisPath).toBe("gemini-v2-tiered");
    expect(result.fingerprint.supporting?.perChapterMetrics?.length).toBe(1);
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
    expect(result.fingerprint.version).toBe("1.4.0");
    expect(result.diagnostics?.structurePass?.success).toBe(true);
  });
});
