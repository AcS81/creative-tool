import { describe, expect, it, vi } from "vitest";

vi.mock("../gemini/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../gemini/client")>();
  return {
    ...actual,
    callGeminiMultimodalJson: vi.fn(),
  };
});

import { callGeminiMultimodalJson } from "../gemini/client";
import * as advancedPass from "./advancedPass";
import type { SegmentPlan } from "./advancedPlanner";
import type { VideoSkeleton } from "./types/skeleton";

const sampleSkeleton: VideoSkeleton = {
  durationSeconds: 120,
  videoType: "tutorial",
  topicSummary: "A quick demo video.",
  chapters: [
    {
      id: "ch1",
      title: "Hook",
      startSeconds: 0,
      endSeconds: 120,
      summary: "Intro and promise.",
      chapterType: "hook",
    },
  ],
  keyMoments: [],
  contentMix: {
    talkingHeadPct: 70,
    brollPct: 10,
    graphicsPct: 10,
    screencastPct: 5,
    otherPct: 5,
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

describe("maxTimelinePoints", () => {
  it("returns duration-based caps", () => {
    expect(advancedPass.maxTimelinePoints(30)).toBe(10);
    expect(advancedPass.maxTimelinePoints(60)).toBe(15);
    expect(advancedPass.maxTimelinePoints(120)).toBe(20);
    expect(advancedPass.maxTimelinePoints(121)).toBe(25);
  });
});

describe("capTimeline", () => {
  it("preserves first and last points while capping length", () => {
    const timeline = Array.from({ length: 30 }, (_, index) => ({
      timeSeconds: index,
      value: index % 5,
    }));
    const capped = advancedPass.capTimeline(timeline, 60);
    expect(capped.length).toBe(15);
    expect(capped[0]).toEqual(timeline[0]);
    expect(capped[capped.length - 1]).toEqual(timeline[timeline.length - 1]);
  });
});

describe("analyzeSegmentAdvanced", () => {
  it("maps hook analysis into sectioned metrics and caps timelines", async () => {
    vi.mocked(callGeminiMultimodalJson).mockReset();
    const timeline = Array.from({ length: 30 }, (_, index) => ({
      timeSeconds: index * 2,
      value: index,
    }));
    vi.mocked(callGeminiMultimodalJson).mockResolvedValue({
      ok: true,
      status: 200,
      rawJson: {
        hookAnalysis: {
          timeToHook: { score: 80, value: "5s", observed: true },
          hookStrength: { score: 70, value: "strong", observed: true },
          paceVariability: { score: 60, value: "12%", observed: true, timeline },
          energyLevel: { score: 65, value: "steady", observed: true, timeline },
        },
      },
    });

    const segment: SegmentPlan = {
      chapterId: "ch1",
      startSeconds: 0,
      endSeconds: 60,
      segmentType: "hook",
      reason: "Hook analysis",
      priority: "high",
    };

    const result = await advancedPass.analyzeSegmentAdvanced({
      youtubeUrl: "https://www.youtube.com/watch?v=abc123",
      segment,
      skeleton: sampleSkeleton,
      segmentId: "seg-hook",
    });

    expect(result.segmentId).toBe("seg-hook");
    expect(result.narrativeArc?.timeToHookSeconds.score).toBe(80);
    expect(result.narrativeArc?.hookStrengthScore.value).toBe("strong");
    expect(result.prosodyArc?.paceVariabilityPct.timeline?.length).toBe(15);
    expect(result.prosodyArc?.energyDriftDbPerMin.timeline?.length).toBe(15);
  });

  it("maps compact hook payload into full metrics with interpolation diagnostics", async () => {
    vi.mocked(callGeminiMultimodalJson).mockReset();
    vi.mocked(callGeminiMultimodalJson).mockResolvedValue({
      ok: true,
      status: 200,
      rawJson: {
        scores: {
          timeToHook: 8,
          hookStrength: 72,
          paceVar: 45,
          energy: 62,
        },
        anchors: [
          { t: 0, v: 120, metric: "pace", type: "start" },
          { t: 30, v: 160, metric: "pace", type: "peak" },
          { t: 60, v: 130, metric: "pace", type: "end" },
          { t: 0, v: 55, metric: "energy", type: "start" },
          { t: 60, v: 70, metric: "energy", type: "end" },
        ],
        flags: ["curiosity_gap", "high_energy"],
      },
    });

    const segment: SegmentPlan = {
      chapterId: "ch1",
      startSeconds: 0,
      endSeconds: 60,
      segmentType: "hook",
      reason: "Hook analysis",
      priority: "high",
    };

    const result = await advancedPass.analyzeSegmentAdvanced({
      youtubeUrl: "https://www.youtube.com/watch?v=abc123",
      segment,
      skeleton: sampleSkeleton,
      segmentId: "seg-hook-compact",
      config: {
        advancedResponseFormat: "compact",
      } as any,
    });

    expect(result.narrativeArc?.timeToHookSeconds.value).toContain("8");
    expect(result.narrativeArc?.hookStrengthScore.score).toBe(72);
    expect(result.prosodyArc?.paceVariabilityPct.timeline?.length).toBe(15);
    expect(result.prosodyArc?.energyDriftDbPerMin.timeline?.length).toBe(15);
    const diagnostics = result.diagnostics as any;
    expect(diagnostics?.interpolation?.pace?.anchorCount).toBe(3);
  });

  it("maps compact prosody/language payload into sectioned metrics", async () => {
    vi.mocked(callGeminiMultimodalJson).mockReset();
    vi.mocked(callGeminiMultimodalJson).mockResolvedValue({
      ok: true,
      status: 200,
      rawJson: {
        scores: {
          paceVar: 30,
          energy: 55,
          address: 70,
          questionRate: 40,
        },
        anchors: [
          { t: 0, v: 5, metric: "address", type: "start" },
          { t: 30, v: 8, metric: "address", type: "peak" },
          { t: 60, v: 6, metric: "address", type: "end" },
        ],
      },
    });

    const segment: SegmentPlan = {
      chapterId: "ch1",
      startSeconds: 0,
      endSeconds: 60,
      segmentType: "prosody_language",
      reason: "Prosody analysis",
      priority: "high",
    };

    const result = await advancedPass.analyzeSegmentAdvanced({
      youtubeUrl: "https://www.youtube.com/watch?v=abc123",
      segment,
      skeleton: sampleSkeleton,
      config: {
        advancedResponseFormat: "compact",
      } as any,
    });

    expect(result.languageTexture?.audienceAddressFrequency.score).toBe(70);
    expect(result.languageTexture?.questionRate.score).toBe(40);
    expect(result.languageTexture?.audienceAddressFrequency.timeline?.length).toBe(15);
    const diagnostics = result.diagnostics as any;
    expect(diagnostics?.interpolation?.address?.anchorCount).toBe(3);
  });

  it("honors advanced schema strategy switching", async () => {
    vi.mocked(callGeminiMultimodalJson).mockReset();
    vi.mocked(callGeminiMultimodalJson).mockResolvedValue({
      ok: true,
      status: 200,
      rawJson: {
        hookAnalysis: {
          timeToHook: { score: 80, value: "5s", observed: true },
          hookStrength: { score: 70, value: "strong", observed: true },
          paceVariability: { score: 60, value: "12%", observed: true, timeline: [] },
          energyLevel: { score: 65, value: "steady", observed: true, timeline: [] },
        },
      },
    });

    const segment: SegmentPlan = {
      chapterId: "ch1",
      startSeconds: 0,
      endSeconds: 60,
      segmentType: "hook",
      reason: "Hook analysis",
      priority: "high",
    };

    await advancedPass.analyzeSegmentAdvanced({
      youtubeUrl: "https://www.youtube.com/watch?v=abc123",
      segment,
      skeleton: sampleSkeleton,
      config: {
        advancedSchemaStrategy: "optional",
        advancedResponseFormat: "full",
      } as any,
    });

    const optionalCall = vi.mocked(callGeminiMultimodalJson).mock.calls[0]?.[0];
    expect(optionalCall?.jsonSchema).toBeUndefined();
    expect(optionalCall?.jsonSchemaFallback).toBeUndefined();
    expect(optionalCall?.forceResponseSchema).toBeUndefined();

    vi.mocked(callGeminiMultimodalJson).mockReset();
    vi.mocked(callGeminiMultimodalJson).mockResolvedValue({
      ok: true,
      status: 200,
      rawJson: {
        hookAnalysis: {
          timeToHook: { score: 80, value: "5s", observed: true },
          hookStrength: { score: 70, value: "strong", observed: true },
          paceVariability: { score: 60, value: "12%", observed: true, timeline: [] },
          energyLevel: { score: 65, value: "steady", observed: true, timeline: [] },
        },
      },
    });

    await advancedPass.analyzeSegmentAdvanced({
      youtubeUrl: "https://www.youtube.com/watch?v=abc123",
      segment,
      skeleton: sampleSkeleton,
      config: {
        advancedSchemaStrategy: "strict",
        advancedResponseFormat: "full",
      } as any,
    });

    const strictCall = vi.mocked(callGeminiMultimodalJson).mock.calls[0]?.[0];
    expect(strictCall?.jsonSchema).toBeDefined();
    expect(strictCall?.forceResponseSchema).toBe(true);
  });
});

describe("executeAdvancedPass", () => {
  it("respects cost guard before running segments", async () => {
    vi.mocked(callGeminiMultimodalJson).mockReset();
    const plan = {
      segments: [
        {
          chapterId: "ch1",
          startSeconds: 0,
          endSeconds: 60,
          segmentType: "hook",
          reason: "Hook analysis",
          priority: "high" as const,
        },
      ],
      totalEstimatedCost: 0.03,
      reason: "Test plan",
    };

    const result = await advancedPass.executeAdvancedPass(plan, {
      youtubeUrl: "https://www.youtube.com/watch?v=abc123",
      skeleton: sampleSkeleton,
    }, {
      maxCostUsd: 0.001,
      estimatedCostPerSegmentUsd: 0.05,
    });

    expect(result.segments.length).toBe(0);
    expect(result.diagnostics.segmentsCompleted).toBe(0);
    expect(vi.mocked(callGeminiMultimodalJson)).not.toHaveBeenCalled();
  });

  it("continues after a segment failure", async () => {
    vi.mocked(callGeminiMultimodalJson).mockReset();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const plan = {
      segments: [
        {
          chapterId: "ch1",
          startSeconds: 0,
          endSeconds: 60,
          segmentType: "hook",
          reason: "Hook analysis",
          priority: "high" as const,
        },
        {
          chapterId: "ch1",
          startSeconds: 60,
          endSeconds: 120,
          segmentType: "ending",
          reason: "Ending analysis",
          priority: "high" as const,
        },
      ],
      totalEstimatedCost: 0.06,
      reason: "Test plan",
    };

    vi.mocked(callGeminiMultimodalJson)
      .mockResolvedValueOnce({
        ok: false,
        errorCode: "UPSTREAM_ERROR",
        errorMessage: "failure",
        status: 500,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        rawJson: {
          endingAnalysis: {
            endingResolution: { score: 60, value: "ok", observed: true },
            openLoopsResolved: { score: 50, value: "1 of 2", observed: true },
          },
        },
      });

    const result = await advancedPass.executeAdvancedPass(plan, {
      youtubeUrl: "https://www.youtube.com/watch?v=abc123",
      skeleton: sampleSkeleton,
    }, {
      maxCostUsd: 1,
    });

    expect(result.segments.length).toBe(2);
    expect(result.diagnostics.segmentsCompleted).toBe(1);
    expect(result.diagnostics.segmentsFailed).toBe(1);
    errorSpy.mockRestore();
  });

  it("stops when duration guard is exceeded", async () => {
    vi.mocked(callGeminiMultimodalJson).mockReset();
    const plan = {
      segments: [
        {
          chapterId: "ch1",
          startSeconds: 0,
          endSeconds: 60,
          segmentType: "hook",
          reason: "Hook analysis",
          priority: "high" as const,
        },
        {
          chapterId: "ch1",
          startSeconds: 60,
          endSeconds: 120,
          segmentType: "ending",
          reason: "Ending analysis",
          priority: "high" as const,
        },
      ],
      totalEstimatedCost: 0.06,
      reason: "Test plan",
    };

    vi.mocked(callGeminiMultimodalJson).mockResolvedValue({
      ok: true,
      status: 200,
      rawJson: {
        hookAnalysis: {
          timeToHook: { score: 80, value: "5s", observed: true },
          hookStrength: { score: 70, value: "strong", observed: true },
          paceVariability: { score: 60, value: "12%", observed: true, timeline: [] },
          energyLevel: { score: 65, value: "steady", observed: true, timeline: [] },
        },
      },
    });

    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(5)
      .mockReturnValueOnce(5);

    const result = await advancedPass.executeAdvancedPass(plan, {
      youtubeUrl: "https://www.youtube.com/watch?v=abc123",
      skeleton: sampleSkeleton,
    }, {
      maxDurationMs: 1,
    });

    expect(result.segments.length).toBe(1);
    expect(vi.mocked(callGeminiMultimodalJson)).toHaveBeenCalledTimes(1);

    nowSpy.mockRestore();
  });
});
