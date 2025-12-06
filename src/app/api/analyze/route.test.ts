import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import prisma from "../../../lib/db";
import { validateFingerprint } from "../../../lib/schemas/fingerprint";
import type { VideoFingerprintJson } from "../../../lib/types";

vi.mock("../../../lib/youtube/api", () => ({
  fetchYoutubeMetadata: vi.fn().mockResolvedValue({
    title: "Sample Test Video",
    description: "Desc",
    channelTitle: "Channel Name",
    durationSeconds: 120,
    publishedAt: "2024-01-01T00:00:00Z",
  }),
}));

const sampleDomain = (label: string, value: number) => ({
  primaryArchetype: `${label} Archetype`,
  summaryText: `${label} summary`,
  scores: [{ key: `${label.toLowerCase()}-axis`, label: `${label} Axis`, value }],
});

const buildFingerprint = (offset: number) =>
  validateFingerprint({
    version: "1.1.0",
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

beforeAll(async () => {
  const refId = `ref-${Date.now()}`;
  const fingerprint = buildFingerprint(5);

  await prisma.creatorProfile.create({
    data: {
      id: refId,
      type: "reference",
      displayName: "Test Reference Creator",
      channelId: `channel-${refId}`,
      analyses: {
        create: {
          id: `${refId}-analysis`,
          youtubeVideoId: "seed-ref-video",
          title: "Reference Video",
          durationSeconds: 600,
          status: "complete",
          videoFingerprint: {
            create: {
              id: `${refId}-fingerprint`,
              fingerprint: JSON.stringify(fingerprint),
            },
          },
        },
      },
    },
  });
});

describe("POST /api/analyze", () => {
  beforeEach(() => {
    process.env.ANALYSIS_MODE = "mock";
  });

  afterEach(async () => {
    delete process.env.ANALYSIS_MODE;
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
    expect(json.fingerprint?.version).toBe("1.1.0");
    expect(Array.isArray(json.nearestReferences)).toBe(true);
    expect(json.nearestReferences.length).toBeGreaterThan(0);
    expect(json.nicheAverageMetaAxes).toBeDefined();
    expect((json.fingerprint as VideoFingerprintJson).metaAxes.voiceIntensity).toBeGreaterThanOrEqual(0);
  });
});
