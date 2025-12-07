import { NextResponse } from "next/server";
import prisma from "../../../lib/db";
import { analyzeVideo } from "../../../lib/analysis/service";
import { parseYouTubeUrl } from "../../../lib/youtube";
import { generateInsights } from "../../../lib/analysis/insights";
import { generateDomainInsights } from "../../../lib/analysis/domainInsights";
import { ConfigError, getAppConfig } from "../../../lib/config";
import { fetchYoutubeMetadata, YoutubeApiError } from "../../../lib/youtube/api";
import { GeminiApiError } from "../../../lib/gemini/client";
import { getAuthContext } from "../../../lib/auth/context";
import { buildSessionCookie, ensureSessionId } from "../../../lib/session";
import { fetchReferenceData } from "./utils";

type AnalyzeRequestBody = {
  url: string;
  creatorDisplayName?: string;
  title?: string;
  durationSeconds?: number;
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

    const cookieHeader = request.headers.get("cookie");
    const { sessionId, isNew } = ensureSessionId(cookieHeader);

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
        channelTitle: metadata.channelTitle || null,
        thumbnailUrl: metadata.thumbnailUrl || null,
        durationSeconds,
        status: "pending",
        sessionId,
      },
    });
    videoAnalysisId = videoAnalysis.id;

    const authContext = await getAuthContext();

    const analysisResult = await analyzeVideo(
      { videoId, title, durationSeconds, creatorDisplayName, channelId: metadata.channelId },
      { config, auth: authContext ?? undefined },
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

    let domainInsights: ReturnType<typeof generateDomainInsights> = {
      voiceProfile: [],
      languageProfile: [],
      narrativeProfile: [],
      visualProfile: [],
      editingProfile: [],
      soundProfile: [],
    };
    try {
      domainInsights = generateDomainInsights(analysisResult.fingerprint, referenceMetaAxes);
    } catch (e) {
      console.warn("domainInsights generation failed, returning empty", e);
    }

    const response = NextResponse.json({
      videoAnalysisId: completedAnalysis.id,
      fingerprint: analysisResult.fingerprint,
      overallArchetype: analysisResult.overallArchetype,
      nearestReferences,
      nicheAverageMetaAxes: averageMetaAxes,
      insights: insights.bullets,
      insightDetails: insights,
      domainInsights,
      diagnostics: analysisResult.diagnostics ?? { source: "gemini-v1-text" },
      metadata: {
        title: metadata.title,
        channelTitle: metadata.channelTitle,
        publishedAt: metadata.publishedAt,
        durationSeconds,
        thumbnailUrl: metadata.thumbnailUrl,
      },
    });
    if (isNew) {
      response.headers.append("Set-Cookie", buildSessionCookie(sessionId));
    }
    return response;
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
