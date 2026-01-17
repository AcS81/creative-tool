import { describe, expect, it } from "vitest";
import {
  InvalidVideoSkeletonError,
  safeValidateVideoSkeleton,
  safeValidateVideoSkeletonPartial,
  validateVideoSkeleton,
} from "./skeleton";
import type { VideoSkeleton } from "../types/skeleton";

const buildSkeleton = (): VideoSkeleton => ({
  durationSeconds: 600,
  videoType: "tutorial",
  topicSummary: "This video explains sourdough bread basics. It covers mixing, proofing, and baking.",
  chapters: [
    {
      id: "ch1",
      title: "Intro",
      startSeconds: 0,
      endSeconds: 60,
      summary: "Introduces the recipe and goals.",
      chapterType: "intro",
    },
    {
      id: "ch2",
      title: "Mixing",
      startSeconds: 60,
      endSeconds: 300,
      summary: "Shows mixing and kneading steps.",
      chapterType: "body",
    },
    {
      id: "ch3",
      title: "Bake",
      startSeconds: 300,
      endSeconds: 600,
      summary: "Covers shaping and baking.",
      chapterType: "conclusion",
    },
  ],
  keyMoments: [
    {
      type: "hook",
      timestamp: 5,
      chapterId: "ch1",
      description: "Promises easy bread with minimal effort.",
    },
    {
      type: "cta",
      timestamp: 590,
      chapterId: "ch3",
      description: "Asks viewers to subscribe for more recipes.",
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
    hasMusic: true,
    hasSFX: false,
    hasOnScreenText: true,
    hasMultipleSpeakers: false,
    primaryLanguage: "en",
    estimatedComplexity: "low",
  },
});

describe("videoSkeletonSchema", () => {
  it("validates a well-formed skeleton", () => {
    const skeleton = buildSkeleton();
    const parsed = validateVideoSkeleton(skeleton);
    expect(parsed.videoType).toBe("tutorial");
    expect(parsed.chapters).toHaveLength(3);
  });

  it("returns success for safe validation when valid", () => {
    const result = safeValidateVideoSkeleton(buildSkeleton());
    expect(result.success).toBe(true);
    expect(result.data?.contentMix.otherPct).toBe(5);
  });

  it("fails when chapters are below the minimum", () => {
    const skeleton = buildSkeleton();
    skeleton.chapters = [skeleton.chapters[0]];
    expect(() => validateVideoSkeleton(skeleton)).toThrow(InvalidVideoSkeletonError);
  });

  it("fails when chapter timestamps are invalid", () => {
    const skeleton = buildSkeleton();
    skeleton.chapters[1].endSeconds = 30;
    expect(() => validateVideoSkeleton(skeleton)).toThrow(InvalidVideoSkeletonError);
  });

  it("fails when content mix sums are off", () => {
    const skeleton = buildSkeleton();
    skeleton.contentMix.otherPct = 25;
    const result = safeValidateVideoSkeleton(skeleton);
    expect(result.success).toBe(false);
    expect(result.error).toContain("contentMix");
  });

  it("allows partial validation for fallback checks", () => {
    const result = safeValidateVideoSkeletonPartial({
      durationSeconds: 120,
      videoType: "other",
    });
    expect(result.success).toBe(true);
    expect(result.data?.durationSeconds).toBe(120);
  });
});
