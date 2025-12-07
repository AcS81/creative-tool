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
  };

  const sampleCandidate = (data: unknown) =>
    samplePayload(JSON.stringify(data ?? { ok: true, marker: "yes" }));

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
      fromFallback: false,
      status: 200,
    });
    expect((result as GeminiMultimodalResult & { rawJson: any }).rawJson.hello).toBe("world");
  });

  it("returns success via fallback when file_data rejected", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (...args: any[]) => {
        call += 1;
        if (call === 1) {
          // primary Gemini call rejected
          return {
            ok: false,
            status: 403,
            json: async () => ({ error: { message: "file_data not allowed" } }),
          } as Response;
        }
        if (call === 2) {
          // fallback download sample
          return {
            ok: true,
            status: 200,
            arrayBuffer: async () => Buffer.from([1, 2, 3]),
          } as Response;
        }
        // fallback Gemini call success
        return {
          ok: true,
          status: 200,
          json: async () => sampleCandidate({ via: "fallback" }),
        } as Response;
      }) as unknown as typeof fetch,
    );

    const result = await callGeminiMultimodalJson({
      youtubeUrl: "https://youtu.be/abc",
      prompt: "test",
      config: baseConfig,
      logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    });

    expect(result).toMatchObject({
      ok: true,
      fromFallback: true,
      status: 200,
    });
    expect((result as GeminiMultimodalResult & { rawJson: any }).rawJson.via).toBe("fallback");
  });

  it("returns fallback error when download fails", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        if (call === 1) {
          return {
            ok: false,
            status: 403,
            json: async () => ({ error: { message: "file_data not allowed" } }),
          } as Response;
        }
        return {
          ok: false,
          status: 404,
          arrayBuffer: async () => Buffer.from([]),
        } as Response;
      }) as unknown as typeof fetch,
    );

    const result = await callGeminiMultimodalJson({
      youtubeUrl: "https://youtu.be/abc",
      prompt: "test",
      config: baseConfig,
      logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    });

    expect(result).toMatchObject({ ok: false, errorCode: "FALLBACK_FAILED" });
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
});
