import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "../db";
import { encryptString } from "../auth/crypto";
import { fetchVideoAnalytics, YoutubeAnalyticsError } from "./analytics";

const originalEnv = { ...process.env };
const originalFindUnique = prisma.youtubeAuthToken.findUnique.bind(prisma.youtubeAuthToken);

const buildMockToken = (userId = "user-1") => ({
  id: "token-1",
  userId,
  accessTokenEncrypted: encryptString("access-token", process.env.TOKEN_ENCRYPTION_KEY as string),
  refreshTokenEncrypted: encryptString("refresh-token", process.env.TOKEN_ENCRYPTION_KEY as string),
  scope: "scope",
  tokenType: "Bearer",
  expiry: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("youtube analytics", () => {
  beforeEach(async () => {
    process.env = { ...originalEnv };
    process.env.ENABLE_PERFORMANCE = "true";
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_REDIRECT_URL = "http://localhost/api/auth/youtube/callback";
    process.env.TOKEN_ENCRYPTION_KEY = "a-secure-key-32-bytes-long-------";
    await prisma.youtubeAuthToken.deleteMany();
    await prisma.user.deleteMany();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    (prisma.youtubeAuthToken as any).findUnique = originalFindUnique;
    process.env = { ...originalEnv };
    await prisma.youtubeAuthToken.deleteMany();
    await prisma.user.deleteMany();
  });

  it("normalizes retention and totals", async () => {
    (prisma.youtubeAuthToken as any).findUnique = vi.fn().mockResolvedValue(buildMockToken());

    // First call: retention report
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          columnHeaders: [
            { name: "elapsedVideoTimeRatio" },
            { name: "audienceWatchRatio" },
            { name: "relativeRetentionPerformance" },
          ],
          rows: [
            [0, 1.0, 1.0],
            [0.5, 0.65, 0.7],
            [1, 0.4, 0.5],
          ],
        }),
      } as any)
      // Second call: totals report
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          columnHeaders: [
            { name: "views" },
            { name: "likes" },
            { name: "comments" },
            { name: "averageViewDuration" },
            { name: "impressionsCtr" },
          ],
          rows: [[1200, 45, 12, 240, 0.075]],
        }),
      } as any);

    const analytics = await fetchVideoAnalytics(
      { videoId: "vid123", channelId: "chan123", auth: { userId: "user-1" } },
      {},
    );

    expect(analytics.retentionSeries.length).toBe(3);
    expect(analytics.retentionSeries[1].audienceRetention).toBeCloseTo(65);
    expect(analytics.views).toBe(1200);
    expect(analytics.likes).toBe(45);
    expect(analytics.comments).toBe(12);
    expect(analytics.avgViewDurationSeconds).toBe(240);
    expect(analytics.ctr).toBeCloseTo(7.5);
  });

  it("falls back when impressionsCtr is unsupported", async () => {
    (prisma.youtubeAuthToken as any).findUnique = vi.fn().mockResolvedValue(buildMockToken());

    const fetchSpy = vi.spyOn(global, "fetch");
    // Retention success
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          columnHeaders: [
            { name: "elapsedVideoTimeRatio" },
            { name: "audienceWatchRatio" },
          ],
          rows: [[0, 1]],
        }),
      } as any)
      // Totals attempt with impressionsCtr -> fail
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({ error: { message: "Unknown identifier (impressionsCtr)" } }),
      } as any)
      // Totals retry without CTR
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          columnHeaders: [
            { name: "views" },
            { name: "likes" },
            { name: "comments" },
            { name: "averageViewDuration" },
          ],
          rows: [[100, 5, 1, 120]],
        }),
      } as any);

    const analytics = await fetchVideoAnalytics(
      { videoId: "vid123", channelId: "chan123", auth: { userId: "user-1" } },
      {},
    );

    expect(analytics.views).toBe(100);
    expect(analytics.avgViewDurationSeconds).toBe(120);
    expect(analytics.ctr).toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("throws forbidden when no token exists", async () => {
    (prisma.youtubeAuthToken as any).findUnique = vi.fn().mockResolvedValue(null);
    await expect(
      fetchVideoAnalytics({ videoId: "v", channelId: "c", auth: { userId: "missing" } }),
    ).rejects.toBeInstanceOf(YoutubeAnalyticsError);
  });

  it("maps quota errors", async () => {
    (prisma.youtubeAuthToken as any).findUnique = vi.fn().mockResolvedValue(buildMockToken());
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      json: async () => ({ error: { message: "quota" } }),
    } as any);

    await expect(
      fetchVideoAnalytics({ videoId: "v", channelId: "c", auth: { userId: "user-1" } }),
    ).rejects.toMatchObject({ type: "QuotaExceeded" });
  });
});
