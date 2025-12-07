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
    beats: [{ label: "hook", start: 0, end: 12 }],
    mini_arc_density: { score: 50, value: "3", explanation: "some arcs" },
    foreshadow_callbacks: { score: 40, value: "2 callbacks", explanation: "few callbacks" },
    transition_clarity: { score: 60, value: "clear", explanation: "clear transitions" },
  },
  visual_edit_sound: {
    environment_stability: { score: 70, value: "80% same setup", explanation: "stable" },
    talking_vs_broll_vs_graphics: { score: 60, value: "60/30/10", explanation: "balanced mix" },
    cut_rate: { score: 55, value: "2.1s avg", explanation: "moderate cuts" },
    pattern_interrupts: { score: 50, value: "3 moments", explanation: "some interrupts" },
    broll_coverage: { score: 58, value: "30%", explanation: "broll occasionally" },
    music_changes: { score: 40, value: "2 changes", explanation: "few music swaps" },
    sfx_density: { score: 30, value: "2 sfx", explanation: "light sfx" },
    silence_for_emphasis: { score: 20, value: "1 pause", explanation: "rare silence" },
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
});
