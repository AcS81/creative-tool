import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import prisma from "../../../lib/db";
import { validateFingerprint } from "../../../lib/schemas/fingerprint";
import type { VideoFingerprintJson } from "../../../lib/types";
import { encryptString } from "../../../lib/auth/crypto";
import { YoutubeAnalyticsError } from "../../../lib/youtube/analytics";

const originalEnv = { ...process.env };

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

vi.mock("../../../lib/gemini/client", () => ({
  getTranscriptAndScenes: vi.fn().mockResolvedValue({
    transcriptSegments: [
      { startSeconds: 0, endSeconds: 10, text: "Intro" },
      { startSeconds: 10, endSeconds: 20, text: "Body" },
    ],
    sceneSegments: [{ startSeconds: 0, endSeconds: 20, label: "Intro", shortSummary: "Opening" }],
  }),
}));

vi.mock("../../../lib/analysis/geminiDomains", () => {
  const buildDomain = (label: string, value: number) => ({
    primaryArchetype: `${label} Archetype`,
    summaryText: `${label} summary`,
    scores: [{ key: `${label.toLowerCase()}-axis`, label: `${label} Axis`, value }],
  });
  return {
    analyzeVoice: vi.fn().mockResolvedValue(buildDomain("Voice", 60)),
    analyzeLanguage: vi.fn().mockResolvedValue(buildDomain("Language", 65)),
    analyzeNarrative: vi.fn().mockResolvedValue(buildDomain("Narrative", 70)),
    analyzeVisual: vi.fn().mockResolvedValue(buildDomain("Visual", 55)),
    analyzeEditing: vi.fn().mockResolvedValue(buildDomain("Editing", 62)),
    analyzeSound: vi.fn().mockResolvedValue(buildDomain("Sound", 58)),
  };
});

const ensureReferenceSeed = async () => {
  const existing = await prisma.creatorProfile.findFirst({ where: { type: "reference" } });
  if (existing) return;
  const fingerprint = validateFingerprint({
    version: "1.1.0",
    createdAt: new Date().toISOString(),
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

  await prisma.creatorProfile.create({
    data: {
      type: "reference",
      displayName: "Perf Ref Creator",
      channelId: "ref-channel",
      analyses: {
        create: {
          youtubeVideoId: "ref-video",
          title: "Ref Video",
          durationSeconds: 600,
          status: "complete",
          videoFingerprint: {
            create: {
              fingerprint: JSON.stringify(fingerprint),
            },
          },
        },
      },
    },
  });
};

describe("POST /api/analyze in performance mode", () => {
  beforeEach(async () => {
    process.env = { ...originalEnv };
    process.env.ANALYSIS_MODE = "gemini";
    process.env.GEMINI_API_KEY = "test-gemini";
    process.env.YOUTUBE_API_KEY = "test-youtube";
    process.env.ENABLE_PERFORMANCE = "true";
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_REDIRECT_URL = "http://localhost/api/auth/youtube/callback";
    process.env.TOKEN_ENCRYPTION_KEY = "a-secure-key-32-bytes-long-------";

    await prisma.youtubeAuthToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.videoFingerprint.deleteMany();
    await prisma.videoAnalysis.deleteMany();
    await prisma.creatorProfile.deleteMany();

    await ensureReferenceSeed();

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
    await prisma.youtubeAuthToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.videoFingerprint.deleteMany();
    await prisma.videoAnalysis.deleteMany();
    await prisma.creatorProfile.deleteMany();
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
