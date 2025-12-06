import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigError } from "../config";
import {
  analyzeVoice,
  analyzeLanguage,
  analyzeNarrative,
  analyzeVisual,
  analyzeEditing,
  analyzeSound,
} from "./geminiDomains";
import { GeminiApiError } from "../gemini/client";

const sampleCandidate = (override?: Partial<any>) => {
  const base = {
    primaryArchetype: "Test Archetype",
    secondaryArchetype: "Alt",
    summaryText: "Short summary.",
    scores: [
      { key: "a", label: "A", value: 50 },
      { key: "b", label: "B", value: 60 },
      { key: "c", label: "C", value: 70 },
    ],
    highlights: ["One", "Two"],
  };
  return JSON.stringify({ ...base, ...override });
};

const samplePayload = (text: string) => ({
  candidates: [
    {
      content: {
        parts: [{ text }],
      },
    },
  ],
});

const mockFetch = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);

const input = {
  transcriptSegments: [{ startSeconds: 0, endSeconds: 10, text: "Intro" }],
  sceneSegments: [{ startSeconds: 0, endSeconds: 10, label: "Intro", shortSummary: "Opening" }],
};

describe("gemini domain analysis functions", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.GEMINI_API_KEY;
  });

  it("returns validated profiles for each domain", async () => {
    vi.stubGlobal("fetch", mockFetch(200, samplePayload(sampleCandidate())));

    const fns = [
      analyzeVoice,
      analyzeLanguage,
      analyzeNarrative,
      analyzeVisual,
      analyzeEditing,
      analyzeSound,
    ];

    for (const fn of fns) {
      const profile = await fn(input);
      expect(profile.primaryArchetype).toBe("Test Archetype");
      expect(profile.scores.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("throws ConfigError when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(analyzeVoice(input)).rejects.toBeInstanceOf(ConfigError);
  });

  it("throws InvalidResponse when schema validation fails", async () => {
    const bad = sampleCandidate({ scores: [] }); // fails min scores
    vi.stubGlobal("fetch", mockFetch(200, samplePayload(bad)));

    await expect(analyzeLanguage(input)).rejects.toMatchObject({
      type: "InvalidResponse",
    } satisfies Partial<GeminiApiError>);
  });

  it("throws UpstreamError on non-OK response", async () => {
    vi.stubGlobal("fetch", mockFetch(500, {}));
    await expect(analyzeNarrative(input)).rejects.toMatchObject({
      type: "UpstreamError",
    } satisfies Partial<GeminiApiError>);
  });
});
