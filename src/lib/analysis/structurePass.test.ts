import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../gemini/client", () => ({
  callGeminiTextJson: vi.fn(),
}));

import { callGeminiTextJson } from "../gemini/client";
import { DEFAULT_STRUCTURE_PASS_TIMEOUT_MS, runStructurePass } from "./structurePass";
import type { VideoSkeleton } from "./types/skeleton";
import type { AppConfig } from "../config";

const sampleSkeleton: VideoSkeleton = {
  durationSeconds: 600,
  videoType: "tutorial",
  topicSummary: "This video teaches basic sourdough steps. It covers mixing, proofing, and baking.",
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
  structurePassTimeoutMs: DEFAULT_STRUCTURE_PASS_TIMEOUT_MS,
  geminiResponseSchemaEnabled: false,
};

beforeEach(() => {
  vi.mocked(callGeminiTextJson).mockClear();
});

describe("runStructurePass", () => {
  it("returns validated skeleton and includes prompt guidance", async () => {
    vi.mocked(callGeminiTextJson).mockResolvedValue({ rawJson: sampleSkeleton, status: 200 });

    const input = {
      youtubeUrl: "https://www.youtube.com/watch?v=abc123",
      durationSeconds: 600,
      youtubeChapters: ["Intro", "Mixing", "Bake"],
    };

    const result = await runStructurePass(input, { config: baseConfig });

    expect(result.source).toBe("gemini");
    expect(result.skeleton.videoType).toBe("tutorial");
    const prompt = vi.mocked(callGeminiTextJson).mock.calls[0]?.[0]?.prompt ?? "";
    expect(prompt).toContain(input.youtubeUrl);
    expect(prompt).toContain("Create 4-5 chapters");
    expect(prompt).toContain("Only 3-4 most important narrative moments");
    expect(prompt).toContain("- Intro");
  });

  it("falls back when Gemini returns invalid skeleton", async () => {
    vi.mocked(callGeminiTextJson).mockResolvedValue({ rawJson: { durationSeconds: 600 }, status: 200 });

    const result = await runStructurePass(
      { youtubeUrl: "https://www.youtube.com/watch?v=abc123" },
      { config: baseConfig },
    );

    expect(result.source).toBe("fallback");
    expect(result.error).toContain("Video skeleton validation failed");
    expect(result.skeleton.videoType).toBe("other");
  });

  it("falls back when Gemini call fails", async () => {
    vi.mocked(callGeminiTextJson).mockRejectedValue(new Error("Gemini failure"));

    const result = await runStructurePass(
      { youtubeUrl: "https://www.youtube.com/watch?v=abc123" },
      { config: baseConfig },
    );

    expect(result.source).toBe("fallback");
    expect(result.error).toContain("Gemini failure");
  });

  it("falls back on timeout", async () => {
    vi.useFakeTimers();
    const timeoutMs = 100;
    vi.mocked(callGeminiTextJson).mockImplementation(({ signal }) => {
      return new Promise((_, reject) => {
        if (signal?.aborted) {
          const err = new Error("Request aborted");
          err.name = "AbortError";
          reject(err);
          return;
        }
        signal?.addEventListener("abort", () => {
          const err = new Error("Request aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    try {
      const pending = runStructurePass(
        { youtubeUrl: "https://www.youtube.com/watch?v=abc123" },
        { config: { ...baseConfig, structurePassTimeoutMs: timeoutMs } },
      );
      await vi.advanceTimersByTimeAsync(timeoutMs + 10);
      const result = await pending;
      expect(result.source).toBe("fallback");
      expect(result.error).toContain("Timed out");
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips Gemini when structure pass is disabled", async () => {
    const result = await runStructurePass(
      { youtubeUrl: "https://www.youtube.com/watch?v=abc123" },
      { config: { ...baseConfig, structurePassEnabled: false } },
    );

    expect(result.source).toBe("fallback");
    expect(result.error).toContain("ENABLE_STRUCTURE_PASS=false");
    expect(vi.mocked(callGeminiTextJson).mock.calls.length).toBe(0);
  });
});
