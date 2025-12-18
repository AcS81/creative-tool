import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import prisma from "../../../lib/db";
import { validateFingerprint } from "../../../lib/schemas/fingerprint";
import type { VideoFingerprintJson } from "../../../lib/types";
import { encryptString } from "../../../lib/auth/crypto";
import { YoutubeAnalyticsError } from "../../../lib/youtube/analytics";
import { buildDefaultAdvancedMetrics } from "../../../lib/analysis/fingerprint/defaults";

const originalEnv = { ...process.env };
const mockAnalyzeVideoMultimodal = vi.fn();
const originalVideoAnalysis = {
  create: prisma.videoAnalysis.create.bind(prisma.videoAnalysis),
  update: prisma.videoAnalysis.update.bind(prisma.videoAnalysis),
  findMany: prisma.videoAnalysis.findMany.bind(prisma.videoAnalysis),
};
const originalVideoFingerprintCreate = prisma.videoFingerprint.create.bind(prisma.videoFingerprint);
const originalCreatorProfile = {
  findFirst: prisma.creatorProfile.findFirst.bind(prisma.creatorProfile),
  create: prisma.creatorProfile.create.bind(prisma.creatorProfile),
};

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

vi.mock("../../../lib/auth/context", () => ({
  getAuthContext: vi.fn().mockResolvedValue({ userId: "user-perf" }),
}));

const mockFetchVideoAnalytics = vi.fn();

vi.mock("../../../lib/youtube/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/youtube/analytics")>();
  return {
    ...actual,
    fetchVideoAnalytics: (...args: any[]) => mockFetchVideoAnalytics(...args),
  };
});

vi.mock("../../../lib/analysis/geminiMultimodalAnalyzer", () => {
  const buildDomain = (label: string, value: number) => ({
    primaryArchetype: `${label} Archetype`,
    summaryText: `${label} summary`,
    scores: [{ key: `${label.toLowerCase()}-axis`, label: `${label} Axis`, value }],
  });
  return {
    analyzeVideoMultimodal: (...args: any[]) => mockAnalyzeVideoMultimodal(...args),
  };
});

const setDefaultMultimodal = () => {
  const buildDomain = (label: string, value: number) => ({
    primaryArchetype: `${label} Archetype`,
    summaryText: `${label} summary`,
    scores: [{ key: `${label.toLowerCase()}-axis`, label: `${label} Axis`, value }],
  });

  mockAnalyzeVideoMultimodal.mockResolvedValue({
    profiles: {
      voice: buildDomain("Voice", 60),
      language: buildDomain("Language", 65),
      narrative: buildDomain("Narrative", 70),
      visual: buildDomain("Visual", 55),
      editing: buildDomain("Editing", 62),
      sound: buildDomain("Sound", 58),
    },
    beats: [{ startSeconds: 0, endSeconds: 10, label: "hook", devices: [] }],
    axisDetails: {},
    diagnostics: {
      fromFallback: false,
      unobservedCounts: { voice: 0, language: 0, narrative: 0, visual_edit_sound: 0 },
    },
  });
};

describe("POST /api/analyze in performance mode", () => {
  beforeEach(async () => {
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
    const referenceFingerprint = validateFingerprint({
      version: "1.3.0",
      createdAt: new Date().toISOString(),
      ...buildDefaultAdvancedMetrics(),
      metaAxes: {
        voiceIntensity: 60,
        conceptualDepth: 60,
        narrativeStructureStrength: 60,
        visualDynamism: 60,
        productionPolish: 60,
      },
      perDomain: {
        voiceProfile: {
          primaryArchetype: "Voice Archetype",
          summaryText: "Voice summary",
          scores: [{ key: "voice-axis", label: "Voice Axis", value: 60 }],
        },
        languageProfile: {
          primaryArchetype: "Language Archetype",
          summaryText: "Language summary",
          scores: [{ key: "language-axis", label: "Language Axis", value: 60 }],
        },
        narrativeProfile: {
          primaryArchetype: "Narrative Archetype",
          summaryText: "Narrative summary",
          scores: [{ key: "narrative-axis", label: "Narrative Axis", value: 60 }],
        },
        visualProfile: {
          primaryArchetype: "Visual Archetype",
          summaryText: "Visual summary",
          scores: [{ key: "visual-axis", label: "Visual Axis", value: 60 }],
        },
        editingProfile: {
          primaryArchetype: "Editing Archetype",
          summaryText: "Editing summary",
          scores: [{ key: "editing-axis", label: "Editing Axis", value: 60 }],
        },
        soundProfile: {
          primaryArchetype: "Sound Archetype",
          summaryText: "Sound summary",
          scores: [{ key: "sound-axis", label: "Sound Axis", value: 60 }],
        },
      },
      overallArchetype: "Ref Archetype",
    });

    (prisma.creatorProfile as any).findFirst = vi.fn().mockResolvedValue(null);
    (prisma.creatorProfile as any).create = vi.fn().mockResolvedValue({
      id: "creator-1",
      type: "user",
      displayName: "Perf User",
      channelId: "channel-perf",
    });

    (prisma.videoAnalysis as any).findMany = vi.fn().mockResolvedValue([
      {
        id: "ref-analysis",
        creatorId: "ref-creator",
        youtubeVideoId: "ref-video",
        title: "Ref Video",
        durationSeconds: 600,
        status: "complete",
        createdAt: new Date(),
        updatedAt: new Date(),
        creator: { id: "ref-creator", displayName: "Perf Ref Creator", type: "reference" },
        videoFingerprint: { fingerprint: JSON.stringify(referenceFingerprint) },
      },
    ]);

    (prisma.videoAnalysis as any).create = vi.fn().mockResolvedValue({
      id: "analysis-1",
      creatorId: "creator-1",
      youtubeVideoId: "perf123",
      title: "Perf Test Video",
      durationSeconds: 300,
      status: "pending",
      sessionId: "sess-perf",
    });

    (prisma.videoAnalysis as any).update = vi.fn().mockResolvedValue({
      id: "analysis-1",
      status: "complete",
    });

    (prisma.videoFingerprint as any).create = vi.fn().mockResolvedValue({
      id: "fingerprint-1",
      fingerprint: JSON.stringify(referenceFingerprint),
    });

    setDefaultMultimodal();

    const user = await prisma.user.create({
      data: { displayName: "Perf User", googleAccountId: "google-user" },
    });
    const encrypted = encryptString("access-token", process.env.TOKEN_ENCRYPTION_KEY as string);
    await prisma.youtubeAuthToken.create({
      data: {
        userId: user.id,
        accessTokenEncrypted: encrypted,
        refreshTokenEncrypted: encrypted,
        scope: "scope",
      },
    });

    mockFetchVideoAnalytics.mockReset();
  });

  afterEach(async () => {
    (prisma.videoAnalysis as any).create = originalVideoAnalysis.create;
    (prisma.videoAnalysis as any).update = originalVideoAnalysis.update;
    (prisma.videoAnalysis as any).findMany = originalVideoAnalysis.findMany;
    (prisma.videoFingerprint as any).create = originalVideoFingerprintCreate;
    (prisma.creatorProfile as any).findFirst = originalCreatorProfile.findFirst;
    (prisma.creatorProfile as any).create = originalCreatorProfile.create;
    mockAnalyzeVideoMultimodal.mockReset();
    process.env = { ...originalEnv };
  });

  it("attaches performanceProfile and sets hasPerformanceData=true when analytics succeed", async () => {
    mockFetchVideoAnalytics.mockResolvedValue({
      retentionSeries: [
        { timeRatio: 0, audienceRetention: 100 },
        { timeRatio: 0.5, audienceRetention: 70 },
        { timeRatio: 1, audienceRetention: 50 },
      ],
      ctr: 7.5,
      views: 1000,
      avgViewDurationSeconds: 200,
      likes: 50,
      comments: 10,
    });

    const res = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify({ url: "https://youtu.be/perf123" }),
        headers: { "Content-Type": "application/json", cookie: "cs_session_id=sess-perf" },
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    const fingerprint = json.fingerprint as VideoFingerprintJson;
    expect(fingerprint.performanceProfile).toBeDefined();
    expect(fingerprint.hasPerformanceData).toBe(true);

    const validated = validateFingerprint(fingerprint);
    expect(validated.performanceProfile?.metrics.views).toBe(1000);
    expect(json.diagnostics?.performanceAttached).toBe(true);
    expect(json.diagnostics?.performanceErrorType).toBeUndefined();
  });

  it("returns creative fingerprint and diagnostics when analytics fails", async () => {
    mockFetchVideoAnalytics.mockRejectedValue(
      new YoutubeAnalyticsError("QuotaExceeded", "Quota exceeded for Analytics", 429),
    );

    const res = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify({ url: "https://youtu.be/perf-fail" }),
        headers: { "Content-Type": "application/json", cookie: "cs_session_id=sess-perf" },
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    const fingerprint = json.fingerprint as VideoFingerprintJson;
    expect(fingerprint.hasPerformanceData).toBe(false);
    expect(fingerprint.performanceProfile).toBeUndefined();

    const validated = validateFingerprint(fingerprint);
    expect(validated.metaAxes.voiceIntensity).toBeGreaterThan(0);

    expect(json.diagnostics?.performanceAttached).toBe(false);
    expect(json.diagnostics?.performanceErrorType).toBe("QuotaExceeded");
    expect(json.diagnostics?.performanceErrorMessage).toContain("Quota exceeded");
  });
});
