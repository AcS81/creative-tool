import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { validateFingerprint } from "../../../lib/schemas/fingerprint";
import type { VideoFingerprintJson } from "../../../lib/types";

const mockPrisma = vi.hoisted(() => ({
  creatorProfile: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
  },
  videoAnalysis: {
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  videoFingerprint: {
    create: vi.fn(),
  },
}));

vi.mock("../../../lib/db", () => ({
  default: mockPrisma,
}));

import { POST } from "./route";

vi.mock("../../../lib/youtube/api", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchYoutubeMetadata: vi.fn().mockResolvedValue({
      title: "Sample Test Video",
      description: "Desc",
      channelTitle: "Channel Name",
      durationSeconds: 120,
      publishedAt: "2024-01-01T00:00:00Z",
      thumbnailUrl: "http://thumb",
    }),
  };
});

const sampleDomain = (label: string, value: number) => ({
  primaryArchetype: `${label} Archetype`,
  summaryText: `${label} summary`,
  scores: [{ key: `${label.toLowerCase()}-axis`, label: `${label} Axis`, value }],
});

const buildFingerprint = (offset: number) =>
  validateFingerprint({
    version: "1.2.0",
    createdAt: new Date().toISOString(),
    metaAxes: {
      voiceIntensity: 50 + offset,
      conceptualDepth: 55 + offset,
      narrativeStructureStrength: 52 + offset,
      visualDynamism: 48 + offset,
      productionPolish: 60 + offset,
    },
    perDomain: {
      voiceProfile: sampleDomain("Voice", 50 + offset),
      languageProfile: sampleDomain("Language", 55 + offset),
      narrativeProfile: sampleDomain("Narrative", 52 + offset),
      visualProfile: sampleDomain("Visual", 48 + offset),
      editingProfile: sampleDomain("Editing", 60 + offset),
      soundProfile: sampleDomain("Sound", 50 + offset),
    },
    overallArchetype: "Test Reference",
  });

beforeAll(() => {
  mockPrisma.creatorProfile.findFirst.mockResolvedValue(null);
});

describe("POST /api/analyze", () => {
  beforeEach(() => {
    process.env.ANALYSIS_MODE = "mock";
    process.env.ENABLE_PERFORMANCE = "false";
    const refId = `ref-${Date.now()}`;
    const referenceFingerprint = buildFingerprint(5);
    mockPrisma.user.findFirst.mockResolvedValue({ id: "user-123", displayName: "Test User" });
    mockPrisma.creatorProfile.create.mockResolvedValue({
      id: refId,
      type: "reference",
      displayName: "Test Reference Creator",
      channelId: `channel-${refId}`,
    });
    mockPrisma.videoAnalysis.create.mockResolvedValue({
      id: `${refId}-analysis-new`,
      creatorId: refId,
      youtubeVideoId: "testvideo123",
      title: "Sample Test Video",
      channelTitle: "Channel Name",
      thumbnailUrl: "http://thumb",
      durationSeconds: 120,
      status: "pending",
      sessionId: "sess",
    });
    mockPrisma.videoAnalysis.update.mockResolvedValue({
      id: `${refId}-analysis-new`,
      status: "complete",
    });
    mockPrisma.videoFingerprint.create.mockResolvedValue({
      id: `${refId}-fingerprint-new`,
      fingerprint: JSON.stringify(referenceFingerprint),
    });
    mockPrisma.videoAnalysis.findMany.mockResolvedValue([
      {
        id: `${refId}-analysis`,
        creatorId: refId,
        youtubeVideoId: "seed-ref-video",
        title: "Reference Video",
        durationSeconds: 600,
        status: "complete",
        createdAt: new Date(),
        creator: {
          id: refId,
          displayName: "Test Reference Creator",
          type: "reference",
        },
        videoFingerprint: {
          fingerprint: JSON.stringify(referenceFingerprint),
        },
      },
    ]);
  });

  afterEach(async () => {
    delete process.env.ANALYSIS_MODE;
    delete process.env.ENABLE_PERFORMANCE;
    vi.clearAllMocks();
  });

  it("returns analysis result with nearest references", async () => {
    const body = {
      url: "https://youtu.be/testvideo123",
      creatorDisplayName: "Route Test User",
      title: "Sample Test Video",
      durationSeconds: 120,
    };

    const res = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.videoAnalysisId).toBeTruthy();
    expect(json.fingerprint?.version).toBe("1.2.0");
    expect(Array.isArray(json.nearestReferences)).toBe(true);
    expect(json.nearestReferences.length).toBeGreaterThan(0);
    expect(json.nicheAverageMetaAxes).toBeDefined();
    expect((json.fingerprint as VideoFingerprintJson).metaAxes.voiceIntensity).toBeGreaterThanOrEqual(0);
    expect(json.metadata?.title).toBe("Sample Test Video");
    expect(json.metadata?.durationSeconds).toBe(120);
    expect(json.metadata?.thumbnailUrl).toBe("http://thumb");
    expect(json.diagnostics?.source).toBe("mock");
  });
});
