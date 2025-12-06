import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigError } from "../config";
import { fetchYoutubeMetadata, YoutubeApiError } from "./api";

const stubFetch = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);

describe("fetchYoutubeMetadata", () => {
  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.YOUTUBE_API_KEY;
  });

  it("returns normalized metadata on success", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch(200, {
        items: [
          {
            snippet: {
              title: "Test Video",
              description: "Desc",
              channelId: "channel-1",
              channelTitle: "Channel",
              publishedAt: "2024-01-01T00:00:00Z",
              thumbnails: { medium: { url: "http://thumb" } },
            },
            contentDetails: {
              duration: "PT1H2M3S",
            },
          },
        ],
      }),
    );

    const result = await fetchYoutubeMetadata("abc123");
    expect(result).toEqual({
      title: "Test Video",
      description: "Desc",
      channelId: "channel-1",
      channelTitle: "Channel",
      publishedAt: "2024-01-01T00:00:00Z",
      durationSeconds: 3723,
      thumbnailUrl: "http://thumb",
    });
  });

  it("throws NotFound when items array is empty", async () => {
    vi.stubGlobal("fetch", stubFetch(200, { items: [] }));
    await expect(fetchYoutubeMetadata("abc123")).rejects.toMatchObject({
      type: "NotFound",
    } satisfies Partial<YoutubeApiError>);
  });

  it("throws Forbidden when API returns 403", async () => {
    vi.stubGlobal("fetch", stubFetch(403, { error: { message: "quota" } }));
    await expect(fetchYoutubeMetadata("abc123")).rejects.toMatchObject({
      type: "Forbidden",
      status: 403,
    } satisfies Partial<YoutubeApiError>);
  });

  it("throws UpstreamError on non-OK responses", async () => {
    vi.stubGlobal("fetch", stubFetch(500, { error: { message: "boom" } }));
    await expect(fetchYoutubeMetadata("abc123")).rejects.toMatchObject({
      type: "UpstreamError",
    } satisfies Partial<YoutubeApiError>);
  });

  it("throws InvalidId for blank ids", async () => {
    await expect(fetchYoutubeMetadata("")).rejects.toMatchObject({
      type: "InvalidId",
    } satisfies Partial<YoutubeApiError>);
  });

  it("throws ConfigError when key is missing", async () => {
    delete process.env.YOUTUBE_API_KEY;
    await expect(fetchYoutubeMetadata("abc123")).rejects.toBeInstanceOf(ConfigError);
  });
});
