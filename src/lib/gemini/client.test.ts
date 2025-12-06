import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigError } from "../config";
import { getTranscriptAndScenes, GeminiApiError } from "./client";

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
