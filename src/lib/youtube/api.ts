import { ConfigError, getAppConfig, type AppConfig } from "../config";

export type YoutubeMetadata = {
  title: string;
  description: string;
  channelId?: string;
  channelTitle: string;
  publishedAt: string;
  durationSeconds: number;
  thumbnailUrl?: string;
};

export type YoutubeApiErrorType = "InvalidId" | "NotFound" | "Forbidden" | "UpstreamError";

export class YoutubeApiError extends Error {
  readonly type: YoutubeApiErrorType;
  readonly status?: number;
  readonly details?: unknown;

  constructor(type: YoutubeApiErrorType, message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "YoutubeApiError";
    this.type = type;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, YoutubeApiError.prototype);
  }
}

const parseIsoDurationSeconds = (isoDuration: string): number => {
  if (!isoDuration) return 0;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = match[1] ? Number.parseInt(match[1], 10) : 0;
  const minutes = match[2] ? Number.parseInt(match[2], 10) : 0;
  const seconds = match[3] ? Number.parseInt(match[3], 10) : 0;
  return hours * 3600 + minutes * 60 + seconds;
};

const buildUrl = (videoId: string, apiKey: string) => {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,contentDetails");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", apiKey);
  return url.toString();
};

type FetchYoutubeMetadataOptions = {
  config?: AppConfig;
};

export async function fetchYoutubeMetadata(
  videoId: string,
  options: FetchYoutubeMetadataOptions = {},
): Promise<YoutubeMetadata> {
  if (!videoId || !videoId.trim()) {
    throw new YoutubeApiError("InvalidId", "A valid videoId is required.");
  }

  const config = options.config ?? getAppConfig();
  const apiKey = config.youtubeApiKey;

  if (!apiKey) {
    throw new ConfigError("YOUTUBE_API_KEY is not set.");
  }

  const url = buildUrl(videoId.trim(), apiKey);

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new YoutubeApiError("UpstreamError", "Failed to reach YouTube Data API.", undefined, error);
  }

  if (response.status === 403) {
    throw new YoutubeApiError(
      "Forbidden",
      "YouTube Data API request forbidden (likely quota or permissions).",
      response.status,
    );
  }

  if (!response.ok) {
    throw new YoutubeApiError(
      "UpstreamError",
      `YouTube Data API returned ${response.status}`,
      response.status,
    );
  }

  let payload: any;
  try {
    payload = await response.json();
  } catch (error) {
    throw new YoutubeApiError("UpstreamError", "YouTube Data API returned invalid JSON.", response.status, error);
  }

  const items = payload?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new YoutubeApiError("NotFound", "Video not found or not accessible.");
  }

  const item = items[0];
  const snippet = item?.snippet;
  const contentDetails = item?.contentDetails;
  const title = snippet?.title;
  const description = snippet?.description ?? "";
  const channelId = snippet?.channelId ?? undefined;
  const channelTitle = snippet?.channelTitle ?? "";
  const publishedAt = snippet?.publishedAt;
  const durationIso = contentDetails?.duration;
  const thumbnailUrl =
    snippet?.thumbnails?.medium?.url ||
    snippet?.thumbnails?.high?.url ||
    snippet?.thumbnails?.default?.url;

  if (!title || !publishedAt || !durationIso) {
    throw new YoutubeApiError("UpstreamError", "YouTube API response missing required fields.");
  }

  return {
    title,
    description,
    channelId,
    channelTitle,
    publishedAt,
    durationSeconds: parseIsoDurationSeconds(durationIso),
    thumbnailUrl,
  };
}
