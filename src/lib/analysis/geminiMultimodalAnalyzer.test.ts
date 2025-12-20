import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../gemini/client", () => {
  class GeminiApiError extends Error {
    type: string;
    status?: number;
    constructor(type: string, message: string, status?: number) {
      super(message);
      this.type = type;
      this.status = status;
    }
  }
  return {
    callGeminiMultimodalJson: vi.fn(),
    GeminiApiError,
  };
});

import { callGeminiMultimodalJson } from "../gemini/client";
import { analyzeVideoMultimodal } from "./geminiMultimodalAnalyzer";

const rich = (value: string, extra: Record<string, unknown> = {}) => ({
  score: 70,
  value,
  explanation: "ok",
  ...extra,
});

const silenceSpans = [
  { startSeconds: 6, endSeconds: 6.9, value: 78, label: "reset", alignedBeat: "hook" },
  { startSeconds: 42, endSeconds: 43.2, value: 88, label: "punch", alignedBeat: "payoff", alignedPunchline: true },
];

const sampleRaw = {
  voice: {
    speaking_rate: { score: 60, value: "155 wpm", explanation: "moderate pace" },
    filler_rate: { score: 40, value: "3 per min", explanation: "some fillers" },
    pauses: { score: 55, value: "0.9s avg", explanation: "occasional resets" },
    loudness_range: { score: 65, value: "12 dB", explanation: "decent range" },
    pitch_variation: { score: 50, value: "medium", explanation: "average pitch movement" },
  },
  language: {
    concreteness: { score: 52, value: "balanced", explanation: "mix of concrete and abstract" },
    metaphor_density: { score: 45, value: "3 per 1k words", explanation: "some metaphors" },
    references: { score: 40, value: "cultural 2", explanation: "few references" },
    humor: { score: 30, value: "1 joke", explanation: "light humor" },
    teaching_vs_riffing: { score: 70, value: "70% instructional", explanation: "more teaching" },
  },
  narrative: {
    beats: [
      { label: "hook", role: "hook", start: 0, end: 12 },
      { label: "escalation", role: "escalation", start: 12, end: 40 },
    ],
    mini_arc_density: { score: 50, value: "3", explanation: "some arcs" },
    foreshadow_callbacks: { score: 40, value: "2 callbacks", explanation: "few callbacks" },
    transition_clarity: { score: 60, value: "clear", explanation: "clear transitions" },
    story_presence: { score: 70, value: "strong", explanation: "narrative-led" },
    devices: [{ type: "callback", timestamp: 10 }],
  },
  visual_edit_sound: {
    environment_stability: { score: 70, value: "80% same setup", explanation: "stable" },
    talking_vs_broll_vs_graphics: { score: 60, value: "60/30/10", explanation: "balanced mix" },
    cut_rate: { score: 55, value: "2.1s avg", explanation: "moderate cuts" },
    pattern_interrupts: { score: 50, value: "3 moments", explanation: "some interrupts" },
    broll_coverage: { score: 58, value: "30%", explanation: "broll occasionally" },
    music_coverage: { score: 65, value: "70%", explanation: "music under most of video" },
    music_changes: { score: 40, value: "2 changes", explanation: "few music swaps" },
    sfx_density: { score: 30, value: "2 sfx", explanation: "light sfx" },
    silence_for_emphasis: { score: 20, value: "1 pause", explanation: "rare silence" },
  },
  advanced_metrics: {
    prosodyArc: {
      paceMeanWpm: rich("150 wpm", { timeline: [{ timeSeconds: 0, value: 150 }] }),
      paceVariabilityPct: rich("8% swing", { timeline: [{ timeSeconds: 0, value: 8 }] }),
      withinSegmentPaceChangePct: rich("3% drift", { segments: [{ startSeconds: 0, endSeconds: 30, deltaPct: 3 }] }),
      emphasisAlignmentScore: rich("key phrases stressed", { items: [{ phrase: "key idea", stressed: true }] }),
      energyDriftDbPerMin: rich("1.2 dB/min", { trend: 0.2 }),
    },
    languageTexture: {
      analogyExampleDefinitionRatio: rich("2/5/1", { counts: { analogies: 2, examples: 5, definitions: 1 } }),
      sentenceCompressionRatio: rich("14 words/idea"),
      humorTimingScore: rich("setup/punch spacing", { items: [{ setupStart: 10, punchStart: 12.5, deltaSeconds: 2.5, landed: true }] }),
      referenceDensityPerMin: rich("3 refs/min", { counts: { cultural: 2, topical: 1 } }),
      questionRate: rich("2 q/min", { counts: { rhetorical: 1, genuine: 1 } }),
    },
    narrativeArc: {
      timeToHookSeconds: rich("7s"),
      hookStrengthScore: rich("clear promise", { items: [{ beatTime: 7, devices: ["contrast"], promiseClarity: "high" }] }),
      segmentCohesionDrift: rich("cohesion drift", { timeline: [{ timeSeconds: 15, value: 0.8 }] }),
      openLoopsUnresolvedRatio: rich("1/3 unresolved", { items: [{ openedAt: 12, resolvedAt: 70, label: "mystery" }] }),
      endingResolutionScore: rich("resolved", { items: [{ payoffDelivered: true, ctaClarity: "explicit", callbackCount: 2 }] }),
    },
    visualEditAlignment: {
      visualEntropy: rich("entropy", { timeline: [{ timeSeconds: 1, value: 0.6 }] }),
      cutRateRefinement: rich("2.0s median", { items: [{ medianShotSeconds: 2, variance: 0.5, beatCouplingDelta: 0.2 }] }),
      silenceForEmphasisFidelity: rich("2 spans", { spans: silenceSpans }),
      audioVisualEmphasisAlignment: rich("peaks aligned", { timeline: [{ timeSeconds: 10, value: 0.8 }] }),
      beatsVsEditsAlignment: rich("edits support beats", { timeline: [{ timeSeconds: 5, value: 0.6 }] }),
      prosodyVsSemanticImportanceAlignment: rich("prosody on key ideas", {
        items: [{ phrase: "core insight", importanceScore: 0.9, stressed: true }],
      }),
    },
    modalityBalance: {
      redundancyVsComplementarity: rich("balanced", { proportions: { redundantPct: 0.2, complementaryPct: 0.7, conflictingPct: 0.1 } }),
      modalityOverReliance: rich("voice-led", { proportions: { voicePct: 0.6, visualPct: 0.3, textPct: 0.1 } }),
    },
    cognitiveLoad: {
      loadPerSecond: rich("load timeline", { timeline: [{ timeSeconds: 0, value: 40 }] }),
      loadHighlights: rich("load spikes", { spans: [{ startSeconds: 20, endSeconds: 22, value: 75, label: "dense" }] }),
    },
    secondOrder: {
      alignmentScore: rich("aligned"),
      driftScore: rich("steady"),
      decayScore: rich("no decay"),
      balanceScore: rich("balanced"),
      timingScore: rich("on time"),
    },
  },
};

describe("analyzeVideoMultimodal", () => {
  beforeEach(() => {
    vi.mocked(callGeminiMultimodalJson).mockResolvedValue({
      ok: true,
      fromFallback: false,
      rawJson: sampleRaw,
      status: 200,
    });
  });

  it("returns domain profiles and beats from multimodal response", async () => {
    const result = await analyzeVideoMultimodal({ youtubeUrl: "https://youtu.be/abc" });
    expect(result.profiles.voice.scores.length).toBeGreaterThan(0);
    expect(result.beats?.[0]?.label).toBe("hook");
    expect(result.beats?.[0]?.role).toBe("hook");
    expect(result.beats?.[0]?.devices).toContain("callback");
    expect(result.diagnostics.fromFallback).toBe(false);
    expect(result.axisDetails["voice.speaking_rate"]?.rawValue).toBe("155 wpm");
  });

  it("flags fallback usage", async () => {
    vi.mocked(callGeminiMultimodalJson).mockResolvedValueOnce({
      ok: true,
      fromFallback: true,
      rawJson: sampleRaw,
      status: 200,
    });
    const result = await analyzeVideoMultimodal({ youtubeUrl: "https://youtu.be/abc" });
    expect(result.profiles.voice.highlights?.some((h) => h.includes("fallback"))).toBe(true);
    expect(result.diagnostics.fromFallback).toBe(true);
    expect(result.axisDetails["voice.speaking_rate"]?.observed).toBe(true);
  });

  it("maps silence spans with intent, strength, and alignment", async () => {
    const result = await analyzeVideoMultimodal({ youtubeUrl: "https://youtu.be/abc" });
    const spans = result.advancedMetrics?.visualEditAlignment.silenceForEmphasisFidelity.spans ?? [];
    expect(spans.length).toBeGreaterThan(0);
    expect(spans[0]?.label).toBe("reset");
    expect(spans[0]?.alignedBeat).toBe("hook");
    expect(spans.some((span) => span?.alignedPunchline === true)).toBe(true);
    expect(typeof spans[0]?.value).toBe("number");
  });
});
