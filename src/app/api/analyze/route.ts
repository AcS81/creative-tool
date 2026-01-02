import { NextResponse } from "next/server";
import prisma from "../../../lib/db";
import { parseYouTubeUrl } from "../../../lib/youtube";
import { ConfigError, getAppConfig } from "../../../lib/config";
import { fetchYoutubeMetadata, YoutubeApiError } from "../../../lib/youtube/api";
import { generateInsights } from "../../../lib/analysis/insights";
import { generateDomainInsights } from "../../../lib/analysis/domainInsights";
import { buildAnalysisConfigSignature, isCacheableFingerprint } from "../../../lib/analysis/analysisCache";
import { buildSessionCookie, ensureSessionId } from "../../../lib/session";
import { enqueueAnalysisJob } from "../../../lib/analysis/jobs";
import { fetchReferenceData, safeParseFingerprint } from "./utils";
import { Prisma } from "@prisma/client";
import { logEvent } from "../../../lib/observability/logger";

type AnalyzeRequestBody = {
  url: string;
  creatorDisplayName?: string;
  title?: string;
  durationSeconds?: number;
  passMode?: "core" | "full";
};

const parseLimit = (raw: string | undefined, fallback: number) => {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return value;
};

const RATE_LIMIT_WINDOW_MINUTES = parseLimit(process.env.ANALYSIS_RATE_LIMIT_WINDOW_MINUTES, 10);
const RATE_LIMIT_MAX_REQUESTS = parseLimit(process.env.ANALYSIS_RATE_LIMIT_MAX_REQUESTS, 5);
const RATE_LIMIT_MAX_ACTIVE = parseLimit(process.env.ANALYSIS_RATE_LIMIT_MAX_ACTIVE, 2);

const buildAnalysisPayload = async (
  analysis: {
    id: string;
    status: string;
    title: string;
    channelTitle: string | null;
    durationSeconds: number;
    thumbnailUrl: string | null;
    creator: { displayName: string };
  },
  fingerprint: ReturnType<typeof safeParseFingerprint>,
  diagnostics?: unknown,
) => {
  if (!fingerprint) {
    throw new Error("Stored fingerprint is invalid.");
  }

  const { nearestReferences, averageMetaAxes, referenceMetaAxes } = await fetchReferenceData(fingerprint);
  const insightDetails = generateInsights(fingerprint.metaAxes, referenceMetaAxes);

  let domainInsights: ReturnType<typeof generateDomainInsights> = {
    voiceProfile: [],
    languageProfile: [],
    narrativeProfile: [],
    visualProfile: [],
    editingProfile: [],
    soundProfile: [],
  };
  try {
    domainInsights = generateDomainInsights(fingerprint, referenceMetaAxes);
  } catch (e) {
    console.warn("domainInsights generation failed for cached analysis, returning empty", e);
  }

  return {
    videoAnalysisId: analysis.id,
    status: analysis.status,
    fingerprint,
    overallArchetype: fingerprint.overallArchetype,
    nearestReferences,
    nicheAverageMetaAxes: averageMetaAxes,
    insights: insightDetails.bullets,
    insightDetails,
    domainInsights,
    diagnostics,
    metadata: {
      title: analysis.title,
      channelTitle: analysis.channelTitle ?? analysis.creator.displayName,
      publishedAt: undefined,
      durationSeconds: analysis.durationSeconds,
      thumbnailUrl: analysis.thumbnailUrl ?? undefined,
    },
  };
};

const resolveCreatorProfile = async (params: { displayName: string; channelId?: string | null }) => {
  const { displayName, channelId } = params;
  const existingByChannel = channelId
    ? await prisma.creatorProfile.findFirst({ where: { channelId } })
    : null;
  if (existingByChannel && existingByChannel.type === "user") {
    return existingByChannel;
  }

  const existingByName = await prisma.creatorProfile.findFirst({
    where: { displayName, type: "user" },
  });
  if (existingByName) {
    return existingByName;
  }

  const safeChannelId = existingByChannel?.type === "reference" ? undefined : channelId ?? undefined;
  return prisma.creatorProfile.create({
    data: {
      displayName,
      type: "user",
      channelId: safeChannelId,
    },
  });
};

export async function POST(request: Request) {
  let videoAnalysisId: string | null = null;

  try {
    const body = (await request.json()) as AnalyzeRequestBody;
    const config = getAppConfig();
    const youtubeUrl = body?.url;
    const requestedPassMode = body?.passMode;
    const normalizedPassMode =
      requestedPassMode === "core" || requestedPassMode === "full" ? requestedPassMode : undefined;
    const requestConfig = normalizedPassMode
      ? {
          ...config,
          multimodalPassMode: normalizedPassMode,
          advancedMetricsEnabled: normalizedPassMode === "full",
        }
      : config;

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

    const configSignature = buildAnalysisConfigSignature(requestConfig);
    const idempotencyKey = `${sessionId}:${videoId}:${configSignature.hash}`;
    let videoAnalysis = await prisma.videoAnalysis.findFirst({
      where: { idempotencyKey },
    });

    if (videoAnalysis) {
      const now = new Date();
      if (videoAnalysis.status === "pending" && (!videoAnalysis.nextAttemptAt || videoAnalysis.nextAttemptAt <= now)) {
        enqueueAnalysisJob(videoAnalysis.id);
      }
      logEvent("info", "analysis_job_idempotent", {
        analysisId: videoAnalysis.id,
        videoId,
        status: videoAnalysis.status,
        analysisConfigHash: configSignature.hash,
      });
      const response = NextResponse.json(
        {
          videoAnalysisId: videoAnalysis.id,
          status: videoAnalysis.status,
          failureReason: videoAnalysis.failureReason ?? undefined,
        },
        { status: 202 },
      );
      if (isNew) {
        response.headers.append("Set-Cookie", buildSessionCookie(sessionId));
      }
      return response;
    }

    const cachedAnalysis = await prisma.videoAnalysis.findFirst({
      where: {
        youtubeVideoId: videoId,
        analysisConfigHash: configSignature.hash,
        status: "complete",
        videoFingerprint: { isNot: null },
      },
      orderBy: { completedAt: "desc" },
      include: { videoFingerprint: true, creator: true },
    });

    if (cachedAnalysis?.videoFingerprint) {
      const cachedFingerprint = safeParseFingerprint(cachedAnalysis.videoFingerprint.fingerprint);
      if (cachedFingerprint && isCacheableFingerprint(cachedFingerprint)) {
        const creatorDisplayName =
          body.creatorDisplayName || cachedAnalysis.channelTitle || "Local Anonymous";
        const creatorProfile = await resolveCreatorProfile({
          displayName: creatorDisplayName,
          channelId: cachedAnalysis.creator.channelId ?? undefined,
        });

        let cachedCopy: Prisma.VideoAnalysisGetPayload<{ include: { creator: true } }> | null = null;
        try {
          cachedCopy = await prisma.$transaction(async (tx) => {
            const created = await tx.videoAnalysis.create({
              data: {
                creatorId: creatorProfile.id,
                youtubeVideoId: videoId,
                title: cachedAnalysis.title,
                channelTitle: cachedAnalysis.channelTitle || null,
                thumbnailUrl: cachedAnalysis.thumbnailUrl || null,
                durationSeconds: cachedAnalysis.durationSeconds,
                status: "complete",
                sessionId,
                passMode: normalizedPassMode ?? null,
                idempotencyKey,
                completedAt: new Date(),
                analysisVersion: requestConfig.analysisVersion,
                analysisConfigHash: configSignature.hash,
                analysisConfigJson: configSignature.serialized,
                diagnosticsJson: cachedAnalysis.diagnosticsJson ?? null,
              },
              include: { creator: true },
            });

            await tx.videoFingerprint.create({
              data: {
                videoAnalysisId: created.id,
                fingerprint: cachedAnalysis.videoFingerprint.fingerprint,
              },
            });

            return created;
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            videoAnalysis = await prisma.videoAnalysis.findFirst({ where: { idempotencyKey } });
            if (videoAnalysis) {
              const response = NextResponse.json(
                {
                  videoAnalysisId: videoAnalysis.id,
                  status: videoAnalysis.status,
                  failureReason: videoAnalysis.failureReason ?? undefined,
                },
                { status: 202 },
              );
              if (isNew) {
                response.headers.append("Set-Cookie", buildSessionCookie(sessionId));
              }
              return response;
            }
          }
          throw error;
        }

        if (!cachedCopy) {
          return NextResponse.json(
            { error: "CacheCopyFailed", message: "Could not reuse cached analysis. Please try again." },
            { status: 500 },
          );
        }

        videoAnalysisId = cachedCopy.id;
        let diagnostics: unknown;
        if (cachedCopy.diagnosticsJson) {
          try {
            diagnostics = JSON.parse(cachedCopy.diagnosticsJson);
          } catch {
            diagnostics = undefined;
          }
        }

        const payload = await buildAnalysisPayload(cachedCopy, cachedFingerprint, diagnostics);
        logEvent("info", "analysis_cache_hit", {
          analysisId: cachedCopy.id,
          cachedFromId: cachedAnalysis.id,
          videoId,
          analysisConfigHash: configSignature.hash,
        });
        const response = NextResponse.json(payload);
        if (isNew) {
          response.headers.append("Set-Cookie", buildSessionCookie(sessionId));
        }
        return response;
      }
    }

    const rateLimitWindowMs = RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
    if (RATE_LIMIT_WINDOW_MINUTES > 0 && RATE_LIMIT_MAX_REQUESTS > 0) {
      const windowStart = new Date(Date.now() - rateLimitWindowMs);
      const recentCount = await prisma.videoAnalysis.count({
        where: {
          sessionId,
          createdAt: { gte: windowStart },
        },
      });
      if (recentCount >= RATE_LIMIT_MAX_REQUESTS) {
        logEvent("warn", "analysis_rate_limited", {
          videoId,
          analysisConfigHash: configSignature.hash,
          reason: "window",
          limit: RATE_LIMIT_MAX_REQUESTS,
          windowMinutes: RATE_LIMIT_WINDOW_MINUTES,
        });
        return NextResponse.json(
          {
            error: "RateLimited",
            message: "Too many analysis requests. Please wait and try again.",
            retryAfterSeconds: Math.ceil(rateLimitWindowMs / 1000),
          },
          { status: 429 },
        );
      }
    }

    if (RATE_LIMIT_MAX_ACTIVE > 0) {
      const activeCount = await prisma.videoAnalysis.count({
        where: {
          sessionId,
          status: { in: ["pending", "running"] },
        },
      });
      if (activeCount >= RATE_LIMIT_MAX_ACTIVE) {
        logEvent("warn", "analysis_rate_limited", {
          videoId,
          analysisConfigHash: configSignature.hash,
          reason: "active",
          limit: RATE_LIMIT_MAX_ACTIVE,
        });
        return NextResponse.json(
          {
            error: "RateLimited",
            message: "Too many analyses running. Please wait for existing jobs to finish.",
          },
          { status: 429 },
        );
      }
    }

    const metadata = await fetchYoutubeMetadata(videoId, { config: requestConfig });
    const creatorDisplayName = body.creatorDisplayName || metadata.channelTitle || "Local Anonymous";
    const title = metadata.title || body.title || "Untitled video";
    const durationSeconds = Number.isFinite(metadata.durationSeconds)
      ? metadata.durationSeconds
      : Number.isFinite(body.durationSeconds)
        ? Number(body.durationSeconds)
        : 0;

    const creatorProfile = await resolveCreatorProfile({
      displayName: creatorDisplayName,
      channelId: metadata.channelId ?? undefined,
    });

    try {
      videoAnalysis = await prisma.videoAnalysis.create({
        data: {
          creatorId: creatorProfile.id,
          youtubeVideoId: videoId,
          title,
          channelTitle: metadata.channelTitle || null,
          thumbnailUrl: metadata.thumbnailUrl || null,
          durationSeconds,
          status: "pending",
          sessionId,
          passMode: normalizedPassMode ?? null,
          idempotencyKey,
          analysisVersion: requestConfig.analysisVersion,
          analysisConfigHash: configSignature.hash,
          analysisConfigJson: configSignature.serialized,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        videoAnalysis = await prisma.videoAnalysis.findFirst({ where: { idempotencyKey } });
      } else {
        throw error;
      }
    }

    if (!videoAnalysis) {
      return NextResponse.json(
        { error: "JobCreateFailed", message: "Could not start analysis. Please try again." },
        { status: 500 },
      );
    }

    videoAnalysisId = videoAnalysis.id;
    enqueueAnalysisJob(videoAnalysis.id);
    logEvent("info", "analysis_job_enqueued", {
      analysisId: videoAnalysis.id,
      videoId,
      passMode: normalizedPassMode ?? null,
      analysisConfigHash: configSignature.hash,
    });

    const response = NextResponse.json(
      {
        videoAnalysisId: videoAnalysis.id,
        status: videoAnalysis.status,
        failureReason: videoAnalysis.failureReason ?? undefined,
      },
      { status: 202 },
    );

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
      error instanceof YoutubeApiError ? error.message : "Could not analyze this URL. Please try again.";

    if (error instanceof YoutubeApiError) {
      console.error("Analyze API upstream error:", error);
    } else {
      console.error("Analyze API error:", error);
    }

    if (videoAnalysisId) {
      await prisma.videoAnalysis.update({
        where: { id: videoAnalysisId },
        data: {
          status: "failed",
          failureReason: message,
          completedAt: new Date(),
          idempotencyKey: null,
        },
      });
      logEvent("alert", "analysis_job_failed_preflight", {
        analysisId: videoAnalysisId,
        videoId,
        failureMessage: message,
      });
    }

    return NextResponse.json({ error: "AnalysisFailed", message }, { status: 500 });
  }
}
