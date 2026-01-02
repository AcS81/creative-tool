import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import prisma from "../../../lib/db";

const originalEnv = { ...process.env };
const originalVideoAnalysis = {
  create: prisma.videoAnalysis.create.bind(prisma.videoAnalysis),
  update: prisma.videoAnalysis.update.bind(prisma.videoAnalysis),
  findFirst: prisma.videoAnalysis.findFirst.bind(prisma.videoAnalysis),
  count: prisma.videoAnalysis.count.bind(prisma.videoAnalysis),
};
const originalCreatorProfile = {
  findFirst: prisma.creatorProfile.findFirst.bind(prisma.creatorProfile),
  create: prisma.creatorProfile.create.bind(prisma.creatorProfile),
};

const mockEnqueueAnalysisJob = vi.fn();

vi.mock("../../../lib/analysis/jobs", () => ({
  enqueueAnalysisJob: (...args: any[]) => mockEnqueueAnalysisJob(...args),
}));

vi.mock("../../../lib/youtube/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/youtube/api")>();
  return {
    ...actual,
    fetchYoutubeMetadata: vi.fn().mockResolvedValue({
      title: "Perf Test Video",
      description: "Perf desc",
      channelId: "channel-perf",
      channelTitle: "Perf Channel",
      durationSeconds: 300,
      publishedAt: "2024-01-02T00:00:00Z",
      thumbnailUrl: "http://thumb/perf",
    }),
  };
});

describe("POST /api/analyze in performance mode", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ANALYSIS_MODE = "gemini";
    process.env.GEMINI_API_KEY = "test-gemini";
    process.env.YOUTUBE_API_KEY = "test-youtube";
    process.env.ANALYSIS_VERSION = "v2";
    process.env.ENABLE_PERFORMANCE = "true";
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_REDIRECT_URL = "http://localhost/api/auth/youtube/callback";
    process.env.TOKEN_ENCRYPTION_KEY = "a-secure-key-32-bytes-long-------";

    (prisma.creatorProfile as any).findFirst = vi.fn().mockResolvedValue(null);
    (prisma.creatorProfile as any).create = vi.fn().mockResolvedValue({
      id: "creator-1",
      type: "user",
      displayName: "Perf User",
      channelId: "channel-perf",
    });

    (prisma.videoAnalysis as any).findFirst = vi.fn().mockResolvedValue(null);
    (prisma.videoAnalysis as any).count = vi.fn().mockResolvedValue(0);
    (prisma.videoAnalysis as any).create = vi.fn().mockResolvedValue({
      id: "analysis-1",
      creatorId: "creator-1",
      youtubeVideoId: "perf123",
      title: "Perf Test Video",
      durationSeconds: 300,
      status: "pending",
      sessionId: "sess-perf",
    });
  });

  afterEach(() => {
    (prisma.videoAnalysis as any).create = originalVideoAnalysis.create;
    (prisma.videoAnalysis as any).update = originalVideoAnalysis.update;
    (prisma.videoAnalysis as any).findFirst = originalVideoAnalysis.findFirst;
    (prisma.videoAnalysis as any).count = originalVideoAnalysis.count;
    (prisma.creatorProfile as any).findFirst = originalCreatorProfile.findFirst;
    (prisma.creatorProfile as any).create = originalCreatorProfile.create;
    mockEnqueueAnalysisJob.mockReset();
    process.env = { ...originalEnv };
  });

  it("queues an analysis job when performance mode is enabled", async () => {
    const res = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify({ url: "https://youtu.be/perf123" }),
        headers: { "Content-Type": "application/json", cookie: "cs_session_id=sess-perf" },
      }),
    );

    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.videoAnalysisId).toBe("analysis-1");
    expect(json.status).toBe("pending");
    expect(mockEnqueueAnalysisJob).toHaveBeenCalledWith("analysis-1");
  });
});
