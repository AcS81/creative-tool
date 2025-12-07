import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeVideo } from "./service";
import type { DomainProfile } from "../types";
import type { AppConfig } from "../config";

const mockAnalyzeVideoMultimodal = vi.fn();
const mockGetTranscriptAndScenes = vi.fn();
const mockAnalyzeVoice = vi.fn();
const mockAnalyzeLanguage = vi.fn();
const mockAnalyzeNarrative = vi.fn();
const mockAnalyzeVisual = vi.fn();
const mockAnalyzeEditing = vi.fn();
const mockAnalyzeSound = vi.fn();

vi.mock("./geminiMultimodalAnalyzer", () => ({
  analyzeVideoMultimodal: (...args: any[]) => mockAnalyzeVideoMultimodal(...args),
}));

vi.mock("../gemini/client", () => ({
  getTranscriptAndScenes: (...args: any[]) => mockGetTranscriptAndScenes(...args),
}));

vi.mock("./geminiDomains", () => ({
  analyzeVoice: (...args: any[]) => mockAnalyzeVoice(...args),
  analyzeLanguage: (...args: any[]) => mockAnalyzeLanguage(...args),
  analyzeNarrative: (...args: any[]) => mockAnalyzeNarrative(...args),
  analyzeVisual: (...args: any[]) => mockAnalyzeVisual(...args),
  analyzeEditing: (...args: any[]) => mockAnalyzeEditing(...args),
  analyzeSound: (...args: any[]) => mockAnalyzeSound(...args),
}));

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
    mockAnalyzeVideoMultimodal.mockReset();
    mockGetTranscriptAndScenes.mockReset();
    mockAnalyzeVoice.mockReset();
    mockAnalyzeLanguage.mockReset();
    mockAnalyzeNarrative.mockReset();
    mockAnalyzeVisual.mockReset();
    mockAnalyzeEditing.mockReset();
    mockAnalyzeSound.mockReset();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    delete process.env.ANALYSIS_MODE;
    delete process.env.GEMINI_API_KEY;
    delete process.env.YOUTUBE_API_KEY;
    delete process.env.ANALYSIS_VERSION;
  });

  const setupTextPathMocks = () => {
    mockGetTranscriptAndScenes.mockResolvedValue({
      transcriptSegments: [{ startSeconds: 0, endSeconds: 10, text: "Intro" }],
      sceneSegments: [{ startSeconds: 0, endSeconds: 10, label: "Intro", shortSummary: "Opening" }],
    });
    mockAnalyzeVoice.mockResolvedValue(mockDomain("Voice", 60));
    mockAnalyzeLanguage.mockResolvedValue(mockDomain("Language", 65));
    mockAnalyzeNarrative.mockResolvedValue(mockDomain("Narrative", 70));
    mockAnalyzeVisual.mockResolvedValue(mockDomain("Visual", 55));
    mockAnalyzeEditing.mockResolvedValue(mockDomain("Editing", 62));
    mockAnalyzeSound.mockResolvedValue(mockDomain("Sound", 58));
  };

  it("returns a valid fingerprint in gemini mode with mocked dependencies", async () => {
    setupTextPathMocks();

    const result = await analyzeVideo({ videoId: "abc123" });
    expect(result.fingerprint.version).toBe("1.2.0");
    expect(result.fingerprint.metaAxes.voiceIntensity).toBeGreaterThan(0);
    expect(result.fingerprint.metaAxes.productionPolish).toBeLessThanOrEqual(100);
    expect(result.fingerprint.perDomain.voiceProfile.scores.length).toBeGreaterThan(0);
    expect(typeof result.overallArchetype).toBe("string");
    expect(result.fingerprint.supporting?.transcriptSegments?.length).toBeGreaterThan(0);
  });

  it("uses text path and reports v1 diagnostics when ANALYSIS_VERSION=v1", async () => {
    process.env.ANALYSIS_VERSION = "v1";
    setupTextPathMocks();

    const result = await analyzeVideo({ videoId: "abc-text" });
    expect(result.diagnostics?.source).toBe("gemini-v1-text");
    expect(result.diagnostics?.analysisVersion).toBe("v1");
    expect(result.fingerprint.supporting?.transcriptSegments?.length).toBeGreaterThan(0);
  });

  it("uses multimodal path and reports diagnostics when enabled", async () => {
    const config: AppConfig = {
      analysisMode: "gemini",
      analysisVersion: "v2",
      analysisV2MultimodalEnabled: true,
      geminiApiKey: "key",
      youtubeApiKey: "yt",
      performanceEnabled: false,
    };

    mockAnalyzeVideoMultimodal.mockResolvedValue({
      profiles: {
        voice: mockDomain("Voice", 60),
        language: mockDomain("Language", 65),
        narrative: mockDomain("Narrative", 70),
        visual: mockDomain("Visual", 55),
        editing: mockDomain("Editing", 62),
        sound: mockDomain("Sound", 58),
      },
      beats: [{ startSeconds: 0, endSeconds: 10, label: "hook", devices: [] }],
      axisDetails: {},
      diagnostics: {
        fromFallback: false,
        unobservedCounts: { voice: 0, language: 0, narrative: 0, visual_edit_sound: 0 },
      },
    });

    const result = await analyzeVideo({ videoId: "abc-multi" }, { config });
    expect(result.diagnostics?.source).toBe("gemini-v2-multimodal");
    expect(result.diagnostics?.analysisVersion).toBe("v2");
    expect(result.diagnostics?.multimodalFallbackUsed).toBe(false);
    expect(result.fingerprint.supporting?.beats?.length).toBe(1);
  });

  it("falls back to mock analysis when ANALYSIS_MODE=mock", async () => {
    process.env.ANALYSIS_MODE = "mock";
    const result = await analyzeVideo({ videoId: "mock-video" });
    expect(result.diagnostics?.source).toBe("mock");
    expect(result.fingerprint.version).toBe("1.2.0");
  });
});
