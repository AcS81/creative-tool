import prisma from "../db";
import { decryptString } from "../auth/crypto";
import { ConfigError, getAppConfig, type AppConfig } from "../config";
import type { AuthContext } from "../auth/context";

export type RetentionSample = {
  timeRatio: number; // 0-1
  audienceRetention: number; // 0-100
};

export type VideoAnalytics = {
  retentionSeries: RetentionSample[];
  ctr?: number; // percentage 0-100
  views?: number;
  avgViewDurationSeconds?: number;
  likes?: number;
  comments?: number;
};

export type YoutubeAnalyticsErrorType = "NotOwner" | "Forbidden" | "QuotaExceeded" | "UpstreamError";

export class YoutubeAnalyticsError extends Error {
  readonly type: YoutubeAnalyticsErrorType;
  readonly status?: number;
  readonly details?: unknown;

  constructor(type: YoutubeAnalyticsErrorType, message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "YoutubeAnalyticsError";
    this.type = type;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, YoutubeAnalyticsError.prototype);
  }
}

type AnalyticsOptions = {
  config?: AppConfig;
};

const ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2/reports";

type DateRange = { start: string; end: string };

const formatDate = (date: Date) => date.toISOString().slice(0, 10);
const buildDateRange = (): DateRange => ({
  start: "2000-01-01",
  end: formatDate(new Date()),
});

const resolveTokens = async (userId: string, config: AppConfig) => {
  if (!config.tokenEncryptionKey) {
    throw new ConfigError("TOKEN_ENCRYPTION_KEY is required to decrypt OAuth tokens.");
  }
  const token = await prisma.youtubeAuthToken.findUnique({ where: { userId } });
  if (!token) {
    throw new YoutubeAnalyticsError("Forbidden", "No YouTube OAuth token found for this user.");
  }
  const accessToken = decryptString(token.accessTokenEncrypted, config.tokenEncryptionKey);
  return { accessToken };
};

const handleAnalyticsError = async (res: Response) => {
  let message = res.statusText;
  try {
    const payload = await res.json();
    if (payload?.error?.message) message = payload.error.message;
  } catch {
    // ignore parse errors
  }

  if (res.status === 403) {
    if (message.toLowerCase().includes("not authorized") || message.toLowerCase().includes("ownership")) {
      throw new YoutubeAnalyticsError("NotOwner", message, res.status);
    }
    throw new YoutubeAnalyticsError("Forbidden", message, res.status);
  }

  if (res.status === 429) {
    throw new YoutubeAnalyticsError("QuotaExceeded", message, res.status);
  }

  throw new YoutubeAnalyticsError("UpstreamError", message, res.status);
};

const fetchReport = async (url: string, accessToken: string) => {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    throw new YoutubeAnalyticsError("UpstreamError", "Failed to reach YouTube Analytics API.", undefined, error);
  }

  if (!res.ok) {
    await handleAnalyticsError(res);
  }

  try {
    return (await res.json()) as any;
  } catch (error) {
    throw new YoutubeAnalyticsError("UpstreamError", "Invalid JSON from YouTube Analytics API.", res.status, error);
  }
};

const buildRetentionUrl = (videoId: string, channelId: string, dateRange: DateRange) => {
  const url = new URL(ANALYTICS_BASE);
  url.searchParams.set("ids", `channel==${channelId}`);
  url.searchParams.set("startDate", dateRange.start);
  url.searchParams.set("endDate", dateRange.end);
  url.searchParams.set("filters", `video==${videoId}`);
  url.searchParams.set("metrics", "audienceWatchRatio,relativeRetentionPerformance");
  url.searchParams.set("dimensions", "elapsedVideoTimeRatio");
  url.searchParams.set("maxResults", "200");
  return url.toString();
};

const buildTotalsUrl = (videoId: string, channelId: string, includeCtr: boolean, dateRange: DateRange) => {
  const url = new URL(ANALYTICS_BASE);
  url.searchParams.set("ids", `channel==${channelId}`);
  url.searchParams.set("startDate", dateRange.start);
  url.searchParams.set("endDate", dateRange.end);
  url.searchParams.set("filters", `video==${videoId}`);
  const metrics = ["views", "likes", "comments", "averageViewDuration", "averageViewPercentage"];
  if (includeCtr) metrics.push("impressionsCtr");
  url.searchParams.set("metrics", metrics.join(","));
  url.searchParams.set("dimensions", "video");
  return url.toString();
};

const normalizeRetention = (payload: any): RetentionSample[] => {
  const headers: string[] = payload?.columnHeaders?.map((h: any) => h?.name) ?? [];
  const rows: any[] = Array.isArray(payload?.rows) ? payload.rows : [];
  const timeIdx = headers.indexOf("elapsedVideoTimeRatio");
  const retentionIdx = headers.indexOf("audienceWatchRatio");
  if (timeIdx === -1 || retentionIdx === -1) return [];
  return rows
    .map((row) => {
      const timeRatio = Number(row?.[timeIdx]);
      const watchRatio = Number(row?.[retentionIdx]);
      if (!Number.isFinite(timeRatio) || !Number.isFinite(watchRatio)) return null;
      return {
        timeRatio,
        audienceRetention: Math.max(0, Math.min(100, watchRatio * 100)),
      };
    })
    .filter(Boolean) as RetentionSample[];
};

const normalizeTotals = (payload: any) => {
  const headers: string[] = payload?.columnHeaders?.map((h: any) => h?.name) ?? [];
  const rows: any[] = Array.isArray(payload?.rows) ? payload.rows : [];
  const row = rows[0] ?? [];
  const getValue = (name: string) => {
    const idx = headers.indexOf(name);
    if (idx === -1) return undefined;
    const value = Number(row?.[idx]);
    return Number.isFinite(value) ? value : undefined;
  };

  const views = getValue("views");
  const likes = getValue("likes");
  const comments = getValue("comments");
  const avgViewDurationSeconds = getValue("averageViewDuration");
  const ctr = getValue("impressionsCtr");

  return {
    views,
    likes,
    comments,
    avgViewDurationSeconds,
    ctr: typeof ctr === "number" ? ctr * 100 : undefined,
  };
};

export async function fetchVideoAnalytics(
  params: { videoId: string; channelId: string; auth: AuthContext },
  options: AnalyticsOptions = {},
): Promise<VideoAnalytics> {
  const { videoId, channelId, auth } = params;
  if (!videoId || !channelId) {
    throw new YoutubeAnalyticsError("UpstreamError", "videoId and channelId are required.");
  }

  const config = options.config ?? getAppConfig();
  if (!config.performanceEnabled) {
    throw new ConfigError("Performance mode disabled or not configured.");
  }

  const { accessToken } = await resolveTokens(auth.userId, config);

  const dateRange = buildDateRange();

  const retentionPayload = await fetchReport(buildRetentionUrl(videoId, channelId, dateRange), accessToken);

  let totalsPayload: any;
  try {
    totalsPayload = await fetchReport(buildTotalsUrl(videoId, channelId, true, dateRange), accessToken);
  } catch (error) {
    const message = (error as Error | undefined)?.message?.toLowerCase?.() ?? "";
    if (message.includes("impressionsctr") || message.includes("unknown identifier")) {
      // Retry without CTR metrics if the API rejects impressionsCtr for this account/video.
      totalsPayload = await fetchReport(buildTotalsUrl(videoId, channelId, false, dateRange), accessToken);
    } else {
      throw error;
    }
  }

  const retentionSeries = normalizeRetention(retentionPayload);
  const totals = normalizeTotals(totalsPayload);

  return {
    retentionSeries,
    ctr: totals.ctr,
    views: totals.views,
    avgViewDurationSeconds: totals.avgViewDurationSeconds,
    likes: totals.likes,
    comments: totals.comments,
  };
}
