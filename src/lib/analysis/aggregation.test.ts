import { describe, expect, it } from "vitest";
import { aggregateCoreMetrics } from "./aggregation";
import type { ChapterCoreMetrics, SummaryMetric } from "./types/coreMetrics";
import type { VideoSkeleton } from "./types/skeleton";

const metric = (value: string, score = 60, observed = true): SummaryMetric => ({
  score,
  value,
  observed,
});

const buildChapterMetrics = (chapterId: string): ChapterCoreMetrics => ({
  chapterId,
  voice: {
    speakingRate: metric("base"),
    fillerRate: metric("base"),
    pauseUsage: metric("base"),
    loudnessRange: metric("base"),
    pitchVariation: metric("base"),
    clarity: metric("base"),
    warmth: metric("base"),
  },
  language: {
    concreteness: metric("base"),
    metaphorDensity: metric("base"),
    references: metric("base"),
    humor: metric("base"),
    teachingVsRiffing: metric("base"),
    storyPresence: metric("base"),
  },
  narrative: {
    structureClarity: metric("base"),
    hookPresence: metric("base"),
    transitionQuality: metric("base"),
    payoffDelivery: metric("base"),
  },
  visual: {
    cutRate: metric("base"),
    environmentStability: metric("base"),
    movement: metric("base"),
    expression: metric("base"),
  },
  sound: {
    musicCoverage: metric("base"),
    musicBalance: metric("base"),
    sfxDensity: metric("base"),
    silenceUsage: metric("base"),
  },
});

const skeleton: VideoSkeleton = {
  durationSeconds: 180,
  videoType: "tutorial",
  topicSummary: "Aggregation test skeleton.",
  chapters: [
    { id: "ch1", title: "Intro", startSeconds: 0, endSeconds: 60, summary: "Intro", chapterType: "intro" },
    { id: "ch2", title: "Body", startSeconds: 60, endSeconds: 180, summary: "Body", chapterType: "body" },
  ],
  keyMoments: [],
  contentMix: {
    talkingHeadPct: 50,
    brollPct: 20,
    graphicsPct: 10,
    screencastPct: 10,
    otherPct: 10,
  },
  analysisHints: {
    hasMusic: false,
    hasSFX: false,
    hasOnScreenText: false,
    hasMultipleSpeakers: false,
    primaryLanguage: "en",
    estimatedComplexity: "low",
  },
};

describe("aggregateCoreMetrics", () => {
  it("weights scores by chapter duration", () => {
    const ch1 = buildChapterMetrics("ch1");
    ch1.voice.speakingRate = metric("short", 50, true);
    const ch2 = buildChapterMetrics("ch2");
    ch2.voice.speakingRate = metric("long", 100, true);

    const result = aggregateCoreMetrics([ch1, ch2], skeleton);

    expect(result.voice.speakingRate.observed).toBe(true);
    expect(result.voice.speakingRate.score).toBeCloseTo(83.33, 2);
    expect(result.voice.speakingRate.value).toBe("long");
  });

  it("returns unobserved when observed runtime is not the majority", () => {
    const ch1 = buildChapterMetrics("ch1");
    ch1.voice.speakingRate = metric("observed", 90, true);
    const ch2 = buildChapterMetrics("ch2");
    ch2.voice.speakingRate = metric("missing", 0, false);

    const result = aggregateCoreMetrics([ch1, ch2], skeleton);

    expect(result.voice.speakingRate.observed).toBe(false);
    expect(result.voice.speakingRate.score).toBe(0);
    expect(result.voice.speakingRate.value).toBe("unobserved");
  });
});
