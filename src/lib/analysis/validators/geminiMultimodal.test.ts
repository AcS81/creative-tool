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
  },
  narrative: {
    beats: [{ label: "hook", start: 0, end: 15 }],
    mini_arc_density: metric("3"),
    foreshadow_callbacks: metric("2 callbacks"),
    transition_clarity: metric("guided"),
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
});

describe("GeminiMultimodalResponseSchema", () => {
  it("parses a valid response", () => {
    const response = buildResponse();
    const parsed = parseGeminiMultimodalJson(response);
    expect(parsed.voice.speaking_rate.value).toBe("160 wpm");
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
});
