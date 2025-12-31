import { describe, expect, it } from "vitest";
import {
  InvalidGeminiResponseError,
  isGeminiMultimodalResponse,
  parseGeminiMultimodalJson,
} from "./geminiMultimodal";
import type { GeminiMultimodalResponse } from "../types/multimodal";

const metric = (value: string, score = 50): GeminiMultimodalResponse["voice"]["speaking_rate"] => ({
  score,
  value,
  explanation: "sample",
});

const advancedMetric = (): GeminiMultimodalResponse["advanced_metrics"] =>
  ({
    prosodyArc: {
      paceMeanWpm: { ...metric("150 wpm"), timeline: [{ timeSeconds: 0, value: 60 }] },
      paceVariabilityPct: { ...metric("12%"), timeline: [{ timeSeconds: 0, value: 40 }] },
      withinSegmentPaceChangePct: {
        ...metric("3%"),
        segments: [{ startSeconds: 0, endSeconds: 10, deltaPct: 3 }],
      },
      emphasisAlignmentScore: metric("aligned"),
      energyDriftDbPerMin: { ...metric("1 dB/min"), trend: 0.1 },
    },
    languageTexture: {
      analogyExampleDefinitionRatio: metric("balanced"),
      sentenceCompressionRatio: metric("12 words/idea"),
      humorTimingScore: { ...metric("jokes"), items: [{ setupStart: 1, punchStart: 3, deltaSeconds: 2, landed: true }] },
      referenceDensityPerMin: { ...metric("2/min"), counts: { cultural: 1 } },
      questionRate: { ...metric("3/min"), counts: { rhetorical: 1, genuine: 2 } },
      audienceAddressFrequency: { ...metric("3 addr/min"), counts: { direct: 2, rhetorical: 1 } },
    },
    narrativeArc: {
      timeToHookSeconds: metric("8s"),
      hookStrengthScore: metric("clear promise"),
      segmentCohesionDrift: { ...metric("stable"), timeline: [{ timeSeconds: 0, value: 70 }] },
      openLoopsUnresolvedRatio: { ...metric("1/3"), items: [{ openedAt: 1, resolvedAt: 50, label: "mystery" }] },
      endingResolutionScore: { ...metric("resolved"), items: [{ payoffDelivered: true }] },
    },
    visualEditAlignment: {
      visualEntropy: { ...metric("entropy"), timeline: [{ timeSeconds: 0, value: 50 }] },
      cutRateRefinement: { ...metric("steady"), items: [{ medianShotSeconds: 2.1, variance: 0.5 }] },
      silenceForEmphasisFidelity: { ...metric("silence spans"), spans: [{ startSeconds: 1, endSeconds: 2, alignedBeat: "hook" }] },
      audioVisualEmphasisAlignment: { ...metric("aligned"), timeline: [{ timeSeconds: 0, value: 80 }] },
      beatsVsEditsAlignment: { ...metric("aligned"), timeline: [{ timeSeconds: 0, value: 75 }] },
      prosodyVsSemanticImportanceAlignment: { ...metric("aligned"), items: [{ phrase: "core", importanceScore: 0.9, stressed: true }] },
    },
    modalityBalance: {
      redundancyVsComplementarity: { ...metric("balanced"), proportions: { redundantPct: 0.2, complementaryPct: 0.7, conflictingPct: 0.1 } },
      modalityOverReliance: { ...metric("voice-led"), proportions: { voicePct: 0.6, visualPct: 0.3, textPct: 0.1 } },
    },
    cognitiveLoad: {
      loadPerSecond: { ...metric("load timeline"), timeline: [{ timeSeconds: 0, value: 40 }] },
      loadHighlights: { ...metric("spikes"), spans: [{ startSeconds: 5, endSeconds: 8, value: 80, label: "dense" }] },
    },
  } as GeminiMultimodalResponse["advanced_metrics"]);

const buildResponse = (): GeminiMultimodalResponse => ({
  voice: {
    speaking_rate: metric("160 wpm"),
    filler_rate: metric("4 per min"),
    pauses: metric("0.8s avg"),
    loudness_range: metric("12 dB"),
    pitch_variation: metric("medium"),
  },
  language: {
    concreteness: metric("62% concrete"),
    metaphor_density: metric("5 per 1k words"),
    references: metric("cultural 3 / historical 0"),
    humor: metric("2 jokes"),
    teaching_vs_riffing: metric("70% instructional"),
    audienceAddressFrequency: metric("3 addr/min"),
  },
  narrative: {
    beats: [
      { label: "hook", role: "hook", start: 0, end: 15 },
      { label: "setup", role: "setup", start: 15, end: 45 },
    ],
    mini_arc_density: metric("3"),
    foreshadow_callbacks: metric("2 callbacks"),
    transition_clarity: metric("guided"),
    story_presence: metric("present"),
  },
  visual_edit_sound: {
    environment_stability: metric("78% same setup"),
    talking_vs_broll_vs_graphics: metric("60/30/10"),
    cut_rate: metric("avg 2.1s"),
    pattern_interrupts: metric("4 timestamps"),
    broll_coverage: metric("30%"),
    music_coverage: metric("70%"),
    music_changes: metric("70% runtime, 3 changes"),
    sfx_density: metric("6 notable SFX"),
    silence_for_emphasis: metric("3 spans ~1s"),
  },
  advanced_metrics: advancedMetric(),
});

describe("GeminiMultimodalResponseSchema", () => {
  it("parses a valid response", () => {
    const response = buildResponse();
    const parsed = parseGeminiMultimodalJson(response);
    expect(parsed.voice.speaking_rate.value).toBe("160 wpm");
    expect(parsed.advanced_metrics?.prosodyArc.paceMeanWpm.timeline?.length).toBeGreaterThan(0);
    expect(isGeminiMultimodalResponse(response)).toBe(true);
  });

  it("accepts unobserved metrics with score 0", () => {
    const response = buildResponse();
    response.voice.pitch_variation = {
      score: 0,
      value: "unobserved",
      explanation: "metric not observable",
    };
    expect(() => parseGeminiMultimodalJson(response)).not.toThrow();
  });

  it("fails when a required metric is missing", () => {
    const response: any = buildResponse();
    delete response.language.concreteness;
    expect(() => parseGeminiMultimodalJson(response)).toThrow(InvalidGeminiResponseError);
    try {
      parseGeminiMultimodalJson(response);
    } catch (error) {
      const msg = (error as InvalidGeminiResponseError).message;
      expect(msg).toContain("language.concreteness");
    }
  });

  it("fails when a metric score is the wrong type", () => {
    const response: any = buildResponse();
    response.voice.speaking_rate.score = "fast";
    expect(() => parseGeminiMultimodalJson(response)).toThrow(InvalidGeminiResponseError);
    try {
      parseGeminiMultimodalJson(response);
    } catch (error) {
      expect((error as InvalidGeminiResponseError).message).toContain("voice.speaking_rate.score");
    }
  });

  it("fails when beats array is empty", () => {
    const response: any = buildResponse();
    response.narrative.beats = [];
    const result = isGeminiMultimodalResponse(response);
    expect(result).toBe(false);
    expect(() => parseGeminiMultimodalJson(response)).toThrow(InvalidGeminiResponseError);
  });

  it("fails when an advanced metric is missing inside advanced_metrics", () => {
    const response: any = buildResponse();
    delete response.advanced_metrics.prosodyArc.paceMeanWpm;
    expect(() => parseGeminiMultimodalJson(response)).toThrow(InvalidGeminiResponseError);
    try {
      parseGeminiMultimodalJson(response);
    } catch (error) {
      expect((error as InvalidGeminiResponseError).message).toContain("advanced_metrics.prosodyArc.paceMeanWpm");
    }
  });

  it("allows responses without advanced_metrics for backward compatibility", () => {
    const response: any = buildResponse();
    delete response.advanced_metrics;
    expect(() => parseGeminiMultimodalJson(response)).not.toThrow();
  });
});
