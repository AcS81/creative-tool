import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigError, type AppConfig } from "../config";
import {
  getTranscriptAndScenes,
  GeminiApiError,
  callGeminiMultimodalJson,
  type GeminiMultimodalResult,
} from "./client";

const mockFetch = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);

const samplePayload = (text: string) => ({
  candidates: [
    {
      content: {
        parts: [{ text }],
      },
    },
  ],
});

describe("getTranscriptAndScenes", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.GEMINI_API_KEY;
  });

  it("returns parsed transcript and scenes on success", async () => {
    const text = JSON.stringify({
      transcriptSegments: [
        { startSeconds: 0, endSeconds: 10, text: "Intro" },
        { startSeconds: 10, endSeconds: 20, text: "Body" },
      ],
      sceneSegments: [{ startSeconds: 0, endSeconds: 20, label: "Intro", shortSummary: "Start" }],
    });

    vi.stubGlobal("fetch", mockFetch(200, samplePayload(text)));

    const result = await getTranscriptAndScenes({ videoUrl: "https://youtu.be/abc" });
    expect(result.transcriptSegments.length).toBe(2);
    expect(result.sceneSegments[0].label).toBe("Intro");
  });

  it("throws ConfigError when key is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(getTranscriptAndScenes({ videoUrl: "https://youtu.be/abc" })).rejects.toBeInstanceOf(
      ConfigError,
    );
  });

  it("throws UpstreamError on non-OK response", async () => {
    vi.stubGlobal("fetch", mockFetch(500, {}));
    await expect(getTranscriptAndScenes({ videoUrl: "https://youtu.be/abc" })).rejects.toMatchObject({
      type: "UpstreamError",
    } satisfies Partial<GeminiApiError>);
  });

  it("throws InvalidResponse when response JSON is malformed", async () => {
    vi.stubGlobal("fetch", mockFetch(200, samplePayload("{not json")));
    await expect(getTranscriptAndScenes({ videoUrl: "https://youtu.be/abc" })).rejects.toMatchObject({
      type: "InvalidResponse",
    } satisfies Partial<GeminiApiError>);
  });

  it("throws InvalidResponse when schema validation fails", async () => {
    const badText = JSON.stringify({ transcriptSegments: [], sceneSegments: [] }); // missing required fields
    vi.stubGlobal("fetch", mockFetch(200, samplePayload(badText)));
    await expect(getTranscriptAndScenes({ videoUrl: "https://youtu.be/abc" })).rejects.toMatchObject({
      type: "InvalidResponse",
    } satisfies Partial<GeminiApiError>);
  });
});

describe("callGeminiMultimodalJson", () => {
  const baseConfig: AppConfig = {
    analysisMode: "gemini",
    analysisVersion: "v2",
    geminiApiKey: "key",
    youtubeApiKey: "yt",
    performanceEnabled: false,
    analysisV2MultimodalEnabled: true,
    advancedMetricsEnabled: true,
    structurePassEnabled: true,
    structurePassTimeoutMs: 30000,
    geminiResponseSchemaEnabled: false,
  };

  const sampleCandidate = (data: unknown, usageMetadata?: Record<string, unknown>) => ({
    ...samplePayload(JSON.stringify(data ?? { ok: true, marker: "yes" })),
    ...(usageMetadata ? { usageMetadata } : {}),
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("fails when feature flag is off", async () => {
    const result = await callGeminiMultimodalJson({
      youtubeUrl: "https://youtu.be/abc",
      prompt: "test",
      config: { ...baseConfig, analysisV2MultimodalEnabled: false },
    });
    expect(result).toMatchObject({ ok: false, errorCode: "FEATURE_DISABLED" });
  });

  it("fails on invalid url", async () => {
    const result = await callGeminiMultimodalJson({
      youtubeUrl: "https://example.com/not-youtube",
      prompt: "test",
      config: baseConfig,
    });
    expect(result).toMatchObject({ ok: false, errorCode: "INVALID_URL" });
  });

  it("fails when key missing", async () => {
    const result = await callGeminiMultimodalJson({
      youtubeUrl: "https://youtu.be/abc",
      prompt: "test",
      config: { ...baseConfig, geminiApiKey: undefined },
    });
    expect(result).toMatchObject({ ok: false, errorCode: "CONFIG_MISSING" });
  });

  it("returns success via primary path", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(200, sampleCandidate({ hello: "world" })) as unknown as typeof fetch,
    );

    const result = await callGeminiMultimodalJson({
      youtubeUrl: "https://youtu.be/abc",
      prompt: "test",
      config: baseConfig,
      logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    });

    expect(result).toMatchObject({
      ok: true,
      status: 200,
    });
    expect((result as GeminiMultimodalResult & { rawJson: any }).rawJson.hello).toBe("world");
  });

  it("records usage and estimated cost when usage metadata is present", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(
        200,
        sampleCandidate({ hello: "world" }, { promptTokenCount: 1000, candidatesTokenCount: 500 }),
      ) as unknown as typeof fetch,
    );

    const result = await callGeminiMultimodalJson({
      youtubeUrl: "https://youtu.be/abc",
      prompt: "test",
      config: baseConfig,
      model: "gemini-2.5-flash",
    });

    expect(result.ok).toBe(true);
    const metrics = (result as GeminiMultimodalResult & { metrics?: any }).metrics;
    expect(metrics?.usage?.promptTokens).toBe(1000);
    expect(metrics?.usage?.candidateTokens).toBe(500);
    expect(metrics?.estimatedCostUsd).toBeCloseTo(0.00155, 6);
  });

  it("returns invalid response when JSON cannot be parsed", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(200, samplePayload("not-json")) as unknown as typeof fetch,
    );

    const result = await callGeminiMultimodalJson({
      youtubeUrl: "https://youtu.be/abc",
      prompt: "test",
      config: baseConfig,
    });

    expect(result).toMatchObject({ ok: false, errorCode: "INVALID_RESPONSE" });
  });

  it("surfaces block reason when Gemini omits candidates", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(200, {
        promptFeedback: { blockReason: "SAFETY", safetyRatings: [{ category: "harassment", probability: "MEDIUM" }] },
      }) as unknown as typeof fetch,
    );

    const result = await callGeminiMultimodalJson({
      youtubeUrl: "https://youtu.be/abc",
      prompt: "test",
      config: baseConfig,
    });

    expect(result).toMatchObject({
      ok: false,
      errorCode: "INVALID_RESPONSE",
    });
    expect((result as any).errorMessage).toContain("block reason");
  });
});
