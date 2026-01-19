import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../gemini/client", () => ({
  callGeminiMultimodalJson: vi.fn(),
}));

import { callGeminiMultimodalJson } from "../gemini/client";
import { analyzeChapterCore, analyzeCoreMetrics, DEFAULT_CORE_CHAPTER_TIMEOUT_MS } from "./corePass";
import type { ChapterCoreMetrics, CoreMetrics } from "./types/coreMetrics";
import type { VideoSkeleton } from "./types/skeleton";
import type { AppConfig } from "../config";

const metric = (value: string, score = 60, observed = true) => ({
  score,
  value,
  observed,
});

const sampleMetrics: CoreMetrics = {
  voice: {
    speakingRate: metric("150 wpm"),
    fillerRate: metric("2/min"),
    pauseUsage: metric("moderate pauses"),
    loudnessRange: metric("10 dB"),
    pitchVariation: metric("varied"),
    clarity: metric("clear"),
    warmth: metric("warm"),
  },
  language: {
    concreteness: metric("mostly concrete"),
    metaphorDensity: metric("occasional"),
    references: metric("few references"),
    humor: metric("light"),
    teachingVsRiffing: metric("structured teaching"),
    storyPresence: metric("light story framing"),
  },
  narrative: {
    structureClarity: metric("clear"),
    hookPresence: metric("strong hook"),
    transitionQuality: metric("smooth"),
    payoffDelivery: metric("solid payoff"),
  },
  visual: {
    cutRate: metric("3s avg"),
    environmentStability: metric("stable setup"),
    movement: metric("minimal movement"),
    expression: metric("expressive"),
  },
  sound: {
    musicCoverage: metric("30%"),
    musicBalance: metric("understated"),
    sfxDensity: metric("light"),
    silenceUsage: metric("occasional"),
  },
};

const sampleSkeleton: VideoSkeleton = {
  durationSeconds: 600,
  videoType: "tutorial",
  topicSummary: "Explains basic camera setup and lighting for beginners.",
  chapters: [
    {
      id: "ch1",
      title: "Intro",
      startSeconds: 0,
      endSeconds: 120,
      summary: "Sets expectations and shows the setup.",
      chapterType: "intro",
    },
  ],
  keyMoments: [
    {
      type: "hook",
      timestamp: 5,
      chapterId: "ch1",
      description: "Promises fast wins for creators.",
    },
  ],
  contentMix: {
    talkingHeadPct: 70,
    brollPct: 10,
    graphicsPct: 10,
    screencastPct: 5,
    otherPct: 5,
  },
  analysisHints: {
    hasMusic: true,
    hasSFX: false,
    hasOnScreenText: true,
    hasMultipleSpeakers: false,
    primaryLanguage: "en",
    estimatedComplexity: "low",
  },
};

const baseConfig: AppConfig = {
  analysisMode: "gemini",
  analysisVersion: "v2",
  geminiApiKey: "key",
  youtubeApiKey: "yt",
  performanceEnabled: false,
  advancedMetricsEnabled: true,
  advancedMaxSegments: 5,
  advancedSegmentMaxSeconds: 120,
  advancedMaxTimelinePoints: 25,
  advancedMaxPassCostUsd: 0.25,
  advancedMaxPassDurationMs: 180000,
  analysisV2MultimodalEnabled: true,
  structurePassEnabled: true,
  structurePassTimeoutMs: 30000,
  geminiResponseSchemaEnabled: false,
};

describe("analyzeChapterCore", () => {
  beforeEach(() => {
    vi.mocked(callGeminiMultimodalJson).mockReset();
  });

  it("returns core metrics with chapterId and uses skeleton context", async () => {
    vi.mocked(callGeminiMultimodalJson).mockResolvedValue({
      ok: true,
      rawJson: sampleMetrics,
      status: 200,
    });

    const result = await analyzeChapterCore(
      {
        youtubeUrl: "https://www.youtube.com/watch?v=abc123",
        startSeconds: 0,
        endSeconds: 120,
        chapterContext: sampleSkeleton.chapters[0],
        videoContext: sampleSkeleton,
      },
      { config: baseConfig },
    );

    expect(result.chapterId).toBe("ch1");
    expect(result.voice.speakingRate.score).toBe(60);

    const call = vi.mocked(callGeminiMultimodalJson).mock.calls[0]?.[0];
    expect(call?.prompt).toContain(sampleSkeleton.videoType);
    expect(call?.prompt).toContain(sampleSkeleton.topicSummary);
    expect(call?.prompt).toContain("Time range: 0s - 120s");
    expect(call?.timeoutMs).toBe(DEFAULT_CORE_CHAPTER_TIMEOUT_MS);
  });

  it("caps chapter analysis at 5 minutes", async () => {
    vi.mocked(callGeminiMultimodalJson).mockResolvedValue({
      ok: true,
      rawJson: sampleMetrics,
      status: 200,
    });

    const longChapter = { ...sampleSkeleton.chapters[0], endSeconds: 1200 };

    await analyzeChapterCore(
      {
        youtubeUrl: "https://www.youtube.com/watch?v=abc123",
        startSeconds: 0,
        endSeconds: 1200,
        chapterContext: longChapter,
        videoContext: { ...sampleSkeleton, chapters: [longChapter] },
      },
      { config: baseConfig },
    );

    const call = vi.mocked(callGeminiMultimodalJson).mock.calls[0]?.[0];
    expect(call?.prompt).toContain("Time range: 0s - 300s");
  });
});

describe("analyzeCoreMetrics", () => {
  beforeEach(() => {
    vi.mocked(callGeminiMultimodalJson).mockReset();
  });

  it("aggregates successful chapters and skips failures", async () => {
    const chapterTwoMetrics: CoreMetrics = {
      ...sampleMetrics,
      voice: {
        ...sampleMetrics.voice,
        speakingRate: metric("130 wpm", 50, true),
      },
    };

    vi.mocked(callGeminiMultimodalJson)
      .mockResolvedValueOnce({ ok: true, rawJson: sampleMetrics, status: 200 })
      .mockResolvedValueOnce({
        ok: false,
        errorCode: "UPSTREAM_ERROR",
        errorMessage: "Gemini failed",
        status: 500,
      })
      .mockResolvedValueOnce({ ok: true, rawJson: chapterTwoMetrics, status: 200 });

    const multiChapterSkeleton: VideoSkeleton = {
      ...sampleSkeleton,
      chapters: [
        sampleSkeleton.chapters[0],
        {
          id: "ch2",
          title: "Setup",
          startSeconds: 120,
          endSeconds: 240,
          summary: "Explains light placement.",
          chapterType: "body",
        },
        {
          id: "ch3",
          title: "Wrap",
          startSeconds: 240,
          endSeconds: 360,
          summary: "Recaps key takeaways.",
          chapterType: "conclusion",
        },
      ],
      keyMoments: [
        sampleSkeleton.keyMoments[0],
        { type: "payoff", timestamp: 300, chapterId: "ch3", description: "Summarizes the payoff." },
      ],
    };

    const result = await analyzeCoreMetrics({
      youtubeUrl: "https://www.youtube.com/watch?v=abc123",
      skeleton: multiChapterSkeleton,
      config: baseConfig,
      maxParallel: 2,
    });

    expect(result.voice.speakingRate.observed).toBe(true);
    expect(result.voice.speakingRate.score).toBe(55);
    expect(vi.mocked(callGeminiMultimodalJson).mock.calls.length).toBe(3);
  });
});
