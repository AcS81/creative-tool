import { NextResponse } from "next/server";
import prisma from "../../../lib/db";
import { analyzeVideo } from "../../../lib/analysis/service";
import { parseYouTubeUrl } from "../../../lib/youtube";
import type { VideoFingerprintJson } from "../../../lib/types";

type AnalyzeRequestBody = {
  url: string;
  creatorDisplayName?: string;
  title?: string;
  durationSeconds?: number;
};

const DEFAULT_TITLE = "Untitled video";
const DEFAULT_DURATION = 0;
const DEFAULT_CREATOR = "Local Anonymous";

const safeParseFingerprint = (fingerprintText?: string | null): VideoFingerprintJson | null => {
  if (!fingerprintText) return null;
  try {
    return JSON.parse(fingerprintText) as VideoFingerprintJson;
  } catch {
    return null;
  }
};

const distanceOnMetaAxes = (
  target: VideoFingerprintJson["metaAxes"],
  candidate: VideoFingerprintJson["metaAxes"],
) => {
  const deltas = [
    target.voiceIntensity - candidate.voiceIntensity,
    target.conceptualDepth - candidate.conceptualDepth,
    target.narrativeStructureStrength - candidate.narrativeStructureStrength,
    target.visualDynamism - candidate.visualDynamism,
    target.productionPolish - candidate.productionPolish,
  ];
  const sumSq = deltas.reduce((sum, value) => sum + value * value, 0);
  return Math.sqrt(sumSq);
};

const computeAverageMetaAxes = (
  fingerprints: VideoFingerprintJson[],
): VideoFingerprintJson["metaAxes"] | null => {
  if (!fingerprints.length) return null;
  const totals = fingerprints.reduce(
    (acc, fp) => ({
      voiceIntensity: acc.voiceIntensity + fp.metaAxes.voiceIntensity,
      conceptualDepth: acc.conceptualDepth + fp.metaAxes.conceptualDepth,
      narrativeStructureStrength:
        acc.narrativeStructureStrength + fp.metaAxes.narrativeStructureStrength,
      visualDynamism: acc.visualDynamism + fp.metaAxes.visualDynamism,
      productionPolish: acc.productionPolish + fp.metaAxes.productionPolish,
    }),
    {
      voiceIntensity: 0,
      conceptualDepth: 0,
      narrativeStructureStrength: 0,
      visualDynamism: 0,
      productionPolish: 0,
    },
  );
  const count = fingerprints.length || 1;
  return {
    voiceIntensity: totals.voiceIntensity / count,
    conceptualDepth: totals.conceptualDepth / count,
    narrativeStructureStrength: totals.narrativeStructureStrength / count,
    visualDynamism: totals.visualDynamism / count,
    productionPolish: totals.productionPolish / count,
  };
};

const fetchReferenceData = async (fingerprint: VideoFingerprintJson) => {
  const references = await prisma.videoAnalysis.findMany({
    where: { creator: { type: "reference" } },
    include: {
      creator: true,
      videoFingerprint: true,
    },
  });

  const parsedFingerprints: VideoFingerprintJson[] = [];

  const distances = references
    .map((analysis) => {
      const parsed = safeParseFingerprint(analysis.videoFingerprint?.fingerprint);
      if (!parsed) return null;
      parsedFingerprints.push(parsed);
      return {
        creatorId: analysis.creatorId,
        displayName: analysis.creator.displayName,
        distance: distanceOnMetaAxes(fingerprint.metaAxes, parsed.metaAxes),
      };
    })
    .filter(Boolean) as Array<{ creatorId: string; displayName: string; distance: number }>;

  return {
    nearestReferences: distances.sort((a, b) => a.distance - b.distance).slice(0, 3),
    averageMetaAxes: computeAverageMetaAxes(parsedFingerprints),
  };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeRequestBody;
    const youtubeUrl = body?.url;

    if (!youtubeUrl) {
      return NextResponse.json(
        { error: "InvalidRequest", message: "URL is required." },
        { status: 400 },
      );
    }

    const videoId = parseYouTubeUrl(youtubeUrl);
    if (!videoId) {
      return NextResponse.json(
        { error: "InvalidYouTubeUrl", message: "Please provide a valid YouTube URL." },
        { status: 400 },
      );
    }

    const creatorDisplayName = body.creatorDisplayName || DEFAULT_CREATOR;
    const title = body.title || DEFAULT_TITLE;
    const durationSeconds = Number.isFinite(body.durationSeconds)
      ? Number(body.durationSeconds)
      : DEFAULT_DURATION;

    const existingCreator = await prisma.creatorProfile.findFirst({
      where: { displayName: creatorDisplayName, type: "user" },
    });

    const creatorProfile =
      existingCreator ??
      (await prisma.creatorProfile.create({
        data: {
          displayName: creatorDisplayName,
          type: "user",
        },
      }));

    const videoAnalysis = await prisma.videoAnalysis.create({
      data: {
        creatorId: creatorProfile.id,
        youtubeVideoId: videoId,
        title,
        durationSeconds,
        status: "pending",
      },
    });

    const analysisResult = await analyzeVideo(
      { videoId, title, durationSeconds, creatorDisplayName },
      { useMock: true },
    );

    await prisma.videoFingerprint.create({
      data: {
        videoAnalysisId: videoAnalysis.id,
        fingerprint: JSON.stringify(analysisResult.fingerprint),
      },
    });

    const completedAnalysis = await prisma.videoAnalysis.update({
      where: { id: videoAnalysis.id },
      data: { status: "complete" },
    });

    const { nearestReferences, averageMetaAxes } = await fetchReferenceData(
      analysisResult.fingerprint,
    );

    return NextResponse.json({
      videoAnalysisId: completedAnalysis.id,
      fingerprint: analysisResult.fingerprint,
      overallArchetype: analysisResult.overallArchetype,
      nearestReferences,
      nicheAverageMetaAxes: averageMetaAxes,
    });
  } catch (error) {
    console.error("Analyze API error:", error);
    return NextResponse.json(
      { error: "ServerError", message: "Could not analyze this URL. Please try again." },
      { status: 500 },
    );
  }
}
