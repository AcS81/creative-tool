import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "../db";
import { encryptString } from "../auth/crypto";
import { fetchVideoAnalytics, YoutubeAnalyticsError } from "./analytics";

const originalEnv = { ...process.env };

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
    await prisma.youtubeAuthToken.deleteMany();
    await prisma.user.deleteMany();
    process.env = { ...originalEnv };
  });

  const seedToken = async () => {
    const user = await prisma.user.create({
      data: { displayName: "Test User" },
    });
    const encrypted = encryptString("access-token", process.env.TOKEN_ENCRYPTION_KEY as string);
    await prisma.youtubeAuthToken.create({
      data: {
        userId: user.id,
        accessTokenEncrypted: encrypted,
        refreshTokenEncrypted: encrypted,
      },
    });
    return user.id;
  };

  it("normalizes retention and totals", async () => {
    const userId = await seedToken();

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
      { videoId: "vid123", channelId: "chan123", auth: { userId } },
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

  it("throws forbidden when no token exists", async () => {
    await expect(
      fetchVideoAnalytics({ videoId: "v", channelId: "c", auth: { userId: "missing" } }),
    ).rejects.toBeInstanceOf(YoutubeAnalyticsError);
  });

  it("maps quota errors", async () => {
    const userId = await seedToken();
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      json: async () => ({ error: { message: "quota" } }),
    } as any);

    await expect(
      fetchVideoAnalytics({ videoId: "v", channelId: "c", auth: { userId } }),
    ).rejects.toMatchObject({ type: "QuotaExceeded" });
  });
});
