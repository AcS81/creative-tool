import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeVideo } from "./service";
import type { DomainProfile } from "../types";

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

describe("analyzeVideo service", () => {
  beforeEach(() => {
    process.env.ANALYSIS_MODE = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    process.env.YOUTUBE_API_KEY = "yt-key";
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    delete process.env.ANALYSIS_MODE;
    delete process.env.GEMINI_API_KEY;
    delete process.env.YOUTUBE_API_KEY;
  });

  it("returns a valid fingerprint in gemini mode with mocked dependencies", async () => {
    vi.mock("../gemini/client", () => ({
      getTranscriptAndScenes: vi.fn().mockResolvedValue({
        transcriptSegments: [{ startSeconds: 0, endSeconds: 10, text: "Intro" }],
        sceneSegments: [{ startSeconds: 0, endSeconds: 10, label: "Intro", shortSummary: "Opening" }],
      }),
    }));

    vi.mock("./geminiDomains", () => ({
      analyzeVoice: vi.fn().mockResolvedValue(mockDomain("Voice", 60)),
      analyzeLanguage: vi.fn().mockResolvedValue(mockDomain("Language", 65)),
      analyzeNarrative: vi.fn().mockResolvedValue(mockDomain("Narrative", 70)),
      analyzeVisual: vi.fn().mockResolvedValue(mockDomain("Visual", 55)),
      analyzeEditing: vi.fn().mockResolvedValue(mockDomain("Editing", 62)),
      analyzeSound: vi.fn().mockResolvedValue(mockDomain("Sound", 58)),
    }));

    const result = await analyzeVideo({ videoId: "abc123" });
    expect(result.fingerprint.version).toBe("1.2.0");
    expect(result.fingerprint.metaAxes.voiceIntensity).toBeGreaterThan(0);
    expect(result.fingerprint.metaAxes.productionPolish).toBeLessThanOrEqual(100);
    expect(result.fingerprint.perDomain.voiceProfile.scores.length).toBeGreaterThan(0);
    expect(typeof result.overallArchetype).toBe("string");
    expect(result.fingerprint.supporting?.transcriptSegments?.length).toBeGreaterThan(0);
  });

  it("falls back to mock analysis when ANALYSIS_MODE=mock", async () => {
    process.env.ANALYSIS_MODE = "mock";
    const result = await analyzeVideo({ videoId: "mock-video" });
    expect(result.diagnostics?.source).toBe("mock");
    expect(result.fingerprint.version).toBe("1.2.0");
  });
});
