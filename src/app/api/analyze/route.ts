import { NextResponse } from "next/server";
import prisma from "../../../lib/db";
import { analyzeVideo } from "../../../lib/analysis/service";
import { parseYouTubeUrl } from "../../../lib/youtube";
import type { VideoFingerprintJson } from "../../../lib/types";
import { generateInsights } from "../../../lib/analysis/insights";
import { ConfigError, getAppConfig } from "../../../lib/config";
import { fetchYoutubeMetadata, YoutubeApiError } from "../../../lib/youtube/api";
import { GeminiApiError } from "../../../lib/gemini/client";
import { computeAverageMetaAxes, findNearestReferences } from "../../../lib/analysis/similarity";

type AnalyzeRequestBody = {
  url: string;
  creatorDisplayName?: string;
  title?: string;
  durationSeconds?: number;
};

const safeParseFingerprint = (fingerprintText?: string | null): VideoFingerprintJson | null => {
  if (!fingerprintText) return null;
  try {
    return JSON.parse(fingerprintText) as VideoFingerprintJson;
  } catch {
    return null;
  }
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

  const validReferences = references
    .map((analysis) => {
      const parsed = safeParseFingerprint(analysis.videoFingerprint?.fingerprint);
      if (!parsed) return null;
      parsedFingerprints.push(parsed);
      return {
        creatorId: analysis.creatorId,
        displayName: analysis.creator.displayName,
        fingerprint: parsed,
      };
    })
    .filter(Boolean) as Array<{ creatorId: string; displayName: string; fingerprint: VideoFingerprintJson }>;

  return {
    nearestReferences: findNearestReferences(fingerprint, validReferences, 3),
    averageMetaAxes: computeAverageMetaAxes(parsedFingerprints),
    referenceMetaAxes: parsedFingerprints.map((fp) => fp.metaAxes),
  };
};

export async function POST(request: Request) {
  let videoAnalysisId: string | null = null;

  try {
    const config = getAppConfig();
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

    const metadata = await fetchYoutubeMetadata(videoId, { config });
    const creatorDisplayName = body.creatorDisplayName || metadata.channelTitle || "Local Anonymous";
    const title = metadata.title || body.title || "Untitled video";
    const durationSeconds = Number.isFinite(metadata.durationSeconds)
      ? metadata.durationSeconds
      : Number.isFinite(body.durationSeconds)
        ? Number(body.durationSeconds)
        : 0;

    const existingCreator = await prisma.creatorProfile.findFirst({
      where: { displayName: creatorDisplayName, type: "user" },
    });

    const creatorProfile =
      existingCreator ??
      (await prisma.creatorProfile.create({
        data: {
          displayName: creatorDisplayName,
          type: "user",
          channelId: metadata.channelId || undefined,
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
    videoAnalysisId = videoAnalysis.id;

    const analysisResult = await analyzeVideo(
      { videoId, title, durationSeconds, creatorDisplayName },
      { config },
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

    const { nearestReferences, averageMetaAxes, referenceMetaAxes } = await fetchReferenceData(
      analysisResult.fingerprint,
    );
    const insights = generateInsights(analysisResult.fingerprint.metaAxes, referenceMetaAxes);

    return NextResponse.json({
      videoAnalysisId: completedAnalysis.id,
      fingerprint: analysisResult.fingerprint,
      overallArchetype: analysisResult.overallArchetype,
      nearestReferences,
      nicheAverageMetaAxes: averageMetaAxes,
      insights,
      metadata: {
        title: metadata.title,
        channelTitle: metadata.channelTitle,
        publishedAt: metadata.publishedAt,
        durationSeconds,
      },
    });
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error("Analyze API misconfigured environment:", error.message);
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 500 },
      );
    }

    const message =
      error instanceof YoutubeApiError || error instanceof GeminiApiError
        ? error.message
        : "Could not analyze this URL. Please try again.";

    if (error instanceof YoutubeApiError || error instanceof GeminiApiError) {
      console.error("Analyze API upstream error:", error);
    } else {
      console.error("Analyze API error:", error);
    }

    if (videoAnalysisId) {
      await prisma.videoAnalysis.update({
        where: { id: videoAnalysisId },
        data: { status: "failed", failureReason: message },
      });
    }

    return NextResponse.json(
      { error: "AnalysisFailed", message },
      { status: 500 },
    );
  }
}
