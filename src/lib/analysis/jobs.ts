import prisma from "../db";
import { analyzeVideo } from "./service";
import type { IngestionPreflight } from "./types";
import { GeminiApiError, preflightGeminiIngestion } from "../gemini/client";
import { getAuthContext } from "../auth/context";
import { ConfigError, getAppConfig, type AppConfig, type MultimodalPassMode } from "../config";
import { YoutubeApiError } from "../youtube/api";
import { buildAnalysisConfigSignature } from "./analysisCache";
import { logEvent } from "../observability/logger";

const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 5000;
const MAX_RETRY_DELAY_MS = 30000;

const buildVideoUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;

const normalizePassMode = (passMode?: string | null): MultimodalPassMode | undefined => {
  if (!passMode) return undefined;
  const normalized = passMode.trim().toLowerCase();
  if (normalized === "core") return "core";
  if (normalized === "full") return "full";
  return undefined;
};

const buildRequestConfig = (config: AppConfig, passMode?: string | null): AppConfig => {
  const normalizedPassMode = normalizePassMode(passMode);
  return normalizedPassMode
    ? {
        ...config,
        multimodalPassMode: normalizedPassMode,
        advancedMetricsEnabled: normalizedPassMode === "full",
      }
    : config;
};

const applyDurationTimeouts = (config: AppConfig, durationSeconds?: number): AppConfig => {
  if (!durationSeconds || durationSeconds <= 0) return config;
  if (
    config.geminiMultimodalTimeoutMs ||
    config.geminiMultimodalTimeoutMsCore ||
    config.geminiMultimodalTimeoutMsAdvanced ||
    config.geminiMultimodalTimeoutMsSalvage
  ) {
    return config;
  }

  let timeoutMs: number | undefined;
  if (durationSeconds >= 3600) {
    timeoutMs = 540000;
  } else if (durationSeconds >= 2400) {
    timeoutMs = 420000;
  } else if (durationSeconds >= 1200) {
    timeoutMs = 300000;
  }

  return timeoutMs ? { ...config, geminiMultimodalTimeoutMs: timeoutMs } : config;
};

const resolveFailureMessage = (error: unknown) => {
  if (error instanceof YoutubeApiError || error instanceof GeminiApiError || error instanceof ConfigError) {
    return error.message;
  }
  return "Could not analyze this URL. Please try again.";
};

const shouldRetry = (error: unknown) =>
  error instanceof GeminiApiError ||
  (error instanceof YoutubeApiError && error.type === "UpstreamError");

const retryDelayMs = (attemptCount: number) =>
  Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * Math.pow(2, Math.max(0, attemptCount - 1)));

export const enqueueAnalysisJob = (videoAnalysisId: string, delayMs = 0) => {
  const schedule = () => {
    void runAnalysisJob(videoAnalysisId);
  };
  if (delayMs > 0) {
    setTimeout(schedule, delayMs);
  } else {
    setTimeout(schedule, 0);
  }
};

export const runAnalysisJob = async (videoAnalysisId: string) => {
  let claimedJob = false;
  const jobStart = Date.now();

  try {
    const now = new Date();
    const claimed = await prisma.videoAnalysis.updateMany({
      where: {
        id: videoAnalysisId,
        status: "pending",
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      data: {
        status: "running",
        startedAt: now,
        attemptCount: { increment: 1 },
        failureReason: null,
        nextAttemptAt: null,
      },
    });

    if (claimed.count === 0) return;
    claimedJob = true;

    const analysis = await prisma.videoAnalysis.findUnique({
      where: { id: videoAnalysisId },
      include: { creator: true },
    });

    if (!analysis) return;

    let ingestionPreflight: IngestionPreflight | undefined;
    let requestConfig: AppConfig | undefined;
    let configSignature: ReturnType<typeof buildAnalysisConfigSignature> | undefined;
    try {
      const config = getAppConfig();
      requestConfig = applyDurationTimeouts(buildRequestConfig(config, analysis.passMode), analysis.durationSeconds);
      configSignature = buildAnalysisConfigSignature(requestConfig);
      const youtubeUrl = buildVideoUrl(analysis.youtubeVideoId);
      logEvent("info", "analysis_job_started", {
        analysisId: analysis.id,
        videoId: analysis.youtubeVideoId,
        attemptCount: analysis.attemptCount,
        maxAttempts: analysis.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
        passMode: analysis.passMode ?? null,
        analysisConfigHash: configSignature?.hash,
      });
      const configUpdate = configSignature
        ? {
            analysisVersion: requestConfig.analysisVersion,
            analysisConfigHash: configSignature.hash,
            analysisConfigJson: configSignature.serialized,
          }
        : undefined;

      if (requestConfig.analysisMode === "gemini" && requestConfig.analysisV2MultimodalEnabled) {
        ingestionPreflight = await preflightGeminiIngestion({ youtubeUrl, config: requestConfig });
      }

      if (ingestionPreflight && !ingestionPreflight.ok) {
        const message = ingestionPreflight.failureMessage ?? "Video ingestion preflight failed.";
        await prisma.videoAnalysis.update({
          where: { id: analysis.id },
          data: {
            status: "failed",
            failureReason: message,
            completedAt: new Date(),
            nextAttemptAt: null,
            diagnosticsJson: JSON.stringify({ ingestionPreflight }),
            idempotencyKey: null,
            ...(configUpdate ?? {}),
          },
        });
        logEvent("alert", "analysis_ingestion_failed", {
          analysisId: analysis.id,
          videoId: analysis.youtubeVideoId,
          attemptCount: analysis.attemptCount,
          analysisConfigHash: configSignature?.hash,
          failureMessage: message,
        });
        return;
      }

      const authContext = await getAuthContext();
      const analysisResult = await analyzeVideo(
        {
          videoId: analysis.youtubeVideoId,
          title: analysis.title,
          durationSeconds: analysis.durationSeconds,
          creatorDisplayName: analysis.creator.displayName,
          channelId: analysis.creator.channelId ?? undefined,
        },
        { config: requestConfig, auth: authContext ?? undefined, ingestionPreflight },
      );

      await prisma.videoFingerprint.upsert({
        where: { videoAnalysisId: analysis.id },
        update: { fingerprint: JSON.stringify(analysisResult.fingerprint) },
        create: {
          videoAnalysisId: analysis.id,
          fingerprint: JSON.stringify(analysisResult.fingerprint),
        },
      });

      const diagnosticsPayload = ingestionPreflight
        ? { ...analysisResult.diagnostics, ingestionPreflight }
        : analysisResult.diagnostics;

      await prisma.videoAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: "complete",
          failureReason: null,
          completedAt: new Date(),
          nextAttemptAt: null,
          diagnosticsJson: JSON.stringify(diagnosticsPayload),
          idempotencyKey: null,
          ...(configUpdate ?? {}),
        },
      });
      logEvent("info", "analysis_job_completed", {
        analysisId: analysis.id,
        videoId: analysis.youtubeVideoId,
        attemptCount: analysis.attemptCount,
        analysisConfigHash: configSignature?.hash,
        durationMs: Date.now() - jobStart,
        coverage: analysisResult.diagnostics?.coverage,
        unobservedCounts: analysisResult.diagnostics?.unobservedCounts,
        salvage: analysisResult.diagnostics?.salvage,
        passMetrics: analysisResult.diagnostics?.passMetrics?.totals,
        advancedMetricsObserved: analysisResult.diagnostics?.advancedMetricsObserved ?? null,
      });
    } catch (error) {
      const message = resolveFailureMessage(error);
      const canRetry = shouldRetry(error);
      const maxAttempts = analysis.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
      const configUpdate =
        requestConfig && configSignature
          ? {
              analysisVersion: requestConfig.analysisVersion,
              analysisConfigHash: configSignature.hash,
              analysisConfigJson: configSignature.serialized,
            }
          : undefined;

      if (canRetry && analysis.attemptCount < maxAttempts) {
        const delayMs = retryDelayMs(analysis.attemptCount);
        const nextAttemptAt = new Date(Date.now() + delayMs);
        await prisma.videoAnalysis.update({
          where: { id: analysis.id },
          data: {
            status: "pending",
            failureReason: message,
            nextAttemptAt,
            ...(configUpdate ?? {}),
          },
        });
        logEvent("warn", "analysis_job_retry_scheduled", {
          analysisId: analysis.id,
          videoId: analysis.youtubeVideoId,
          attemptCount: analysis.attemptCount,
          maxAttempts,
          retryInMs: delayMs,
          failureMessage: message,
          analysisConfigHash: configSignature?.hash,
        });
        enqueueAnalysisJob(analysis.id, delayMs);
        return;
      }

      await prisma.videoAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: "failed",
          failureReason: message,
          completedAt: new Date(),
          nextAttemptAt: null,
          idempotencyKey: null,
          ...(configUpdate ?? {}),
        },
      });
      logEvent("alert", "analysis_job_failed", {
        analysisId: analysis.id,
        videoId: analysis.youtubeVideoId,
        attemptCount: analysis.attemptCount,
        maxAttempts,
        failureMessage: message,
        analysisConfigHash: configSignature?.hash,
      });
    }
  } catch (error) {
    console.error("Analysis job failed unexpectedly", error);
    if (!claimedJob) return;
    const message = resolveFailureMessage(error);
    try {
      await prisma.videoAnalysis.update({
        where: { id: videoAnalysisId },
        data: {
          status: "failed",
          failureReason: message,
          completedAt: new Date(),
          nextAttemptAt: null,
          idempotencyKey: null,
        },
      });
      logEvent("alert", "analysis_job_failed_unhandled", {
        analysisId: videoAnalysisId,
        failureMessage: message,
      });
    } catch (updateError) {
      console.error("Failed to mark analysis job as failed", updateError);
    }
  }
};
