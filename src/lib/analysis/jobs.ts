import { Prisma } from "@prisma/client";
import prisma from "../db";
import { analyzeVideo, buildAnalysisFromMultimodal } from "./service";
import type { IngestionPreflight } from "./types";
import { GeminiApiError, preflightGeminiIngestion } from "../gemini/client";
import { getAuthContext } from "../auth/context";
import { ConfigError, getAppConfig, type AppConfig, type MultimodalPassMode } from "../config";
import { YoutubeApiError } from "../youtube/api";
import { buildAnalysisConfigSignature } from "./analysisCache";
import { logEvent } from "../observability/logger";
import { FINGERPRINT_SCHEMA_VERSION } from "../schemas/fingerprintContract";
import { FINGERPRINT_SCHEMA_HASH } from "../schemas/fingerprintSchemaHash";
import {
  buildMultimodalResult,
  runMultimodalAdvanced,
  runMultimodalCore,
  type MultimodalAdvancedPayload,
  type MultimodalCorePayload,
} from "./geminiMultimodalAnalyzer";
import { isJobClaimable, resolveResumePlan, type AnalysisStage } from "./jobUtils";

const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 5000;
const MAX_RETRY_DELAY_MS = 30000;

const parseMs = (raw: string | undefined, fallback: number) => {
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const LEASE_DURATION_MS = parseMs(process.env.ANALYSIS_LEASE_DURATION_MS, 120000);
const HEARTBEAT_INTERVAL_MS = parseMs(process.env.ANALYSIS_LEASE_HEARTBEAT_MS, 30000);
const WORKER_POLL_INTERVAL_MS = parseMs(process.env.ANALYSIS_WORKER_POLL_MS, 2000);

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

  const passMode = config.multimodalPassMode ?? "full";

  let coreTimeoutMs: number | undefined;
  let advancedTimeoutMs: number | undefined;
  let salvageTimeoutMs: number | undefined;

  if (durationSeconds >= 3600) {
    coreTimeoutMs = 900000;
    advancedTimeoutMs = 2400000;
    salvageTimeoutMs = 1800000;
  } else if (durationSeconds >= 2400) {
    coreTimeoutMs = 720000;
    advancedTimeoutMs = 1800000;
    salvageTimeoutMs = 1200000;
  } else if (durationSeconds >= 1200) {
    coreTimeoutMs = 600000;
    advancedTimeoutMs = 1500000;
    salvageTimeoutMs = 900000;
  } else if (durationSeconds >= 600) {
    coreTimeoutMs = 360000;
    advancedTimeoutMs = 900000;
    salvageTimeoutMs = 600000;
  }

  if (!coreTimeoutMs) return config;

  return {
    ...config,
    geminiMultimodalTimeoutMs: passMode === "core" ? coreTimeoutMs : (advancedTimeoutMs ?? coreTimeoutMs),
    geminiMultimodalTimeoutMsCore: coreTimeoutMs,
    geminiMultimodalTimeoutMsAdvanced: passMode === "core" ? undefined : advancedTimeoutMs ?? coreTimeoutMs,
    geminiMultimodalTimeoutMsSalvage: passMode === "core" ? undefined : salvageTimeoutMs ?? advancedTimeoutMs ?? coreTimeoutMs,
  };
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

const sleep = (delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs));

const buildLeaseExpiry = (now: Date) => new Date(now.getTime() + LEASE_DURATION_MS);

const safeParseJson = <T>(raw: string | null | undefined): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const updateStage = async (analysisId: string, leaseOwner: string, stage: AnalysisStage) => {
  const now = new Date();
  const updated = await prisma.videoAnalysis.updateMany({
    where: { id: analysisId, leaseOwner },
    data: {
      analysisStage: stage,
      stageStartedAt: now,
      stageCompletedAt: null,
      leaseHeartbeatAt: now,
      leaseExpiresAt: buildLeaseExpiry(now),
    },
  });
  return updated.count > 0;
};

const completeStage = async (
  analysisId: string,
  leaseOwner: string,
  data?: Prisma.VideoAnalysisUpdateManyMutationInput,
) => {
  const now = new Date();
  return prisma.videoAnalysis.updateMany({
    where: { id: analysisId, leaseOwner },
    data: {
      stageCompletedAt: now,
      leaseHeartbeatAt: now,
      leaseExpiresAt: buildLeaseExpiry(now),
      ...(data ?? {}),
    },
  });
};

const startLeaseHeartbeat = (analysisId: string, leaseOwner: string) => {
  let active = true;
  const tick = async () => {
    if (!active) return;
    const now = new Date();
    await prisma.videoAnalysis.updateMany({
      where: { id: analysisId, leaseOwner },
      data: {
        leaseHeartbeatAt: now,
        leaseExpiresAt: buildLeaseExpiry(now),
      },
    });
  };
  const interval = setInterval(() => void tick(), HEARTBEAT_INTERVAL_MS);
  void tick();
  return () => {
    active = false;
    clearInterval(interval);
  };
};

export const enqueueAnalysisJob = async (videoAnalysisId: string, delayMs = 0) => {
  const nextAttemptAt = delayMs > 0 ? new Date(Date.now() + delayMs) : new Date();
  await prisma.videoAnalysis.updateMany({
    where: { id: videoAnalysisId, status: { not: "complete" } },
    data: {
      status: "pending",
      nextAttemptAt,
      leaseOwner: null,
      leaseExpiresAt: null,
      leaseHeartbeatAt: null,
    },
  });
};

const claimNextAnalysisJob = async (leaseOwner: string) => {
  const now = new Date();
  const candidate = await prisma.videoAnalysis.findFirst({
    where: {
      OR: [
        {
          status: "pending",
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        },
        {
          status: "running",
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
        },
      ],
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
  });

  if (!candidate || !isJobClaimable(candidate, now)) return null;

  const leaseExpiresAt = buildLeaseExpiry(now);
  const baseUpdate: Prisma.VideoAnalysisUpdateManyMutationInput = {
    status: "running",
    leaseOwner,
    leaseExpiresAt,
    leaseHeartbeatAt: now,
    nextAttemptAt: null,
    failureReason: null,
    startedAt: candidate.startedAt ?? now,
  };

  const updateData: Prisma.VideoAnalysisUpdateManyMutationInput =
    candidate.status === "pending"
      ? { ...baseUpdate, attemptCount: { increment: 1 } }
      : baseUpdate;

  const updated = await prisma.videoAnalysis.updateMany({
    where:
      candidate.status === "pending"
        ? {
            id: candidate.id,
            status: "pending",
            OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
          }
        : {
            id: candidate.id,
            status: "running",
            OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
          },
    data: updateData,
  });

  if (updated.count === 0) return null;
  return candidate.id;
};

export const runAnalysisWorker = async (options: { workerId?: string; pollIntervalMs?: number } = {}) => {
  const workerId =
    options.workerId ??
    process.env.ANALYSIS_WORKER_ID ??
    `worker-${process.pid}-${Math.random().toString(16).slice(2)}`;
  const pollIntervalMs = options.pollIntervalMs ?? WORKER_POLL_INTERVAL_MS;
  let active = true;

  const shutdown = () => {
    active = false;
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  while (active) {
    const jobId = await claimNextAnalysisJob(workerId);
    if (!jobId) {
      await sleep(pollIntervalMs);
      continue;
    }

    try {
      await runAnalysisJob(jobId, { leaseOwner: workerId });
    } catch (error) {
      console.error("Analysis worker job failed", error);
    }
  }
};

export const runAnalysisJob = async (videoAnalysisId: string, options: { leaseOwner: string }) => {
  const jobStart = Date.now();
  const { leaseOwner } = options;
  const stopHeartbeat = startLeaseHeartbeat(videoAnalysisId, leaseOwner);

  let analysis: Prisma.VideoAnalysisGetPayload<{ include: { creator: true } }> | null = null;
  let requestConfig: AppConfig | undefined;
  let configSignature: ReturnType<typeof buildAnalysisConfigSignature> | undefined;
  let ingestionPreflight: IngestionPreflight | undefined;
  let corePayload: MultimodalCorePayload | null = null;
  let advancedPayload: MultimodalAdvancedPayload | null = null;

  try {
    analysis = await prisma.videoAnalysis.findUnique({
      where: { id: videoAnalysisId },
      include: { creator: true },
    });

    if (!analysis || analysis.leaseOwner !== leaseOwner) return;

    const config = getAppConfig();
    requestConfig = applyDurationTimeouts(buildRequestConfig(config, analysis.passMode), analysis.durationSeconds);
    configSignature = buildAnalysisConfigSignature(requestConfig);
    const advancedMetricsEnabled = (requestConfig.multimodalPassMode ?? "full") !== "core" && requestConfig.advancedMetricsEnabled !== false;

    const configUpdate = {
      analysisVersion: requestConfig.analysisVersion,
      analysisConfigHash: configSignature.hash,
      analysisConfigJson: configSignature.serialized,
      fingerprintSchemaVersion: FINGERPRINT_SCHEMA_VERSION,
      fingerprintSchemaHash: FINGERPRINT_SCHEMA_HASH,
    };

    ingestionPreflight = safeParseJson<IngestionPreflight>(analysis.ingestionJson) ?? undefined;
    corePayload = safeParseJson<MultimodalCorePayload>(analysis.coreMetricsJson);
    if (corePayload && !corePayload.parsed) {
      corePayload = null;
    }
    advancedPayload = safeParseJson<MultimodalAdvancedPayload>(analysis.advancedMetricsJson);

    const resumePlan = resolveResumePlan({
      storedConfigHash: analysis.analysisConfigHash,
      storedSchemaHash: analysis.fingerprintSchemaHash,
      currentConfigHash: configSignature.hash,
      currentSchemaHash: FINGERPRINT_SCHEMA_HASH,
      hasIngestion: Boolean(ingestionPreflight),
      hasCore: Boolean(corePayload?.parsed),
      hasAdvanced: Boolean(advancedPayload),
      advancedMetricsEnabled,
    });

    if (resumePlan.resetStages) {
      const resetStage: AnalysisStage =
        requestConfig.analysisMode === "gemini" && requestConfig.analysisV2MultimodalEnabled
          ? "ingestion"
          : "finalize";
      const reset = await prisma.videoAnalysis.updateMany({
        where: { id: analysis.id, leaseOwner },
        data: {
          ingestionJson: null,
          coreMetricsJson: null,
          advancedMetricsJson: null,
          analysisStage: resetStage,
          stageStartedAt: new Date(),
          stageCompletedAt: null,
          ...configUpdate,
        },
      });
      if (reset.count === 0) {
        logEvent("warn", "analysis_job_orphaned", {
          analysisId: analysis.id,
          videoId: analysis.youtubeVideoId,
          stage: "reset",
        });
        return;
      }
      ingestionPreflight = undefined;
      corePayload = null;
      advancedPayload = null;
    } else {
      const updated = await prisma.videoAnalysis.updateMany({
        where: { id: analysis.id, leaseOwner },
        data: configUpdate,
      });
      if (updated.count === 0) {
        logEvent("warn", "analysis_job_orphaned", {
          analysisId: analysis.id,
          videoId: analysis.youtubeVideoId,
          stage: "config_update",
        });
        return;
      }
    }

    const youtubeUrl = buildVideoUrl(analysis.youtubeVideoId);
    logEvent("info", "analysis_job_started", {
      analysisId: analysis.id,
      videoId: analysis.youtubeVideoId,
      attemptCount: analysis.attemptCount,
      maxAttempts: analysis.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      passMode: analysis.passMode ?? null,
      durationSeconds: analysis.durationSeconds,
      analysisConfigHash: configSignature.hash,
      geminiTimeouts: {
        baseMs: requestConfig.geminiMultimodalTimeoutMs ?? null,
        coreMs: requestConfig.geminiMultimodalTimeoutMsCore ?? null,
        advancedMs: requestConfig.geminiMultimodalTimeoutMsAdvanced ?? null,
        salvageMs: requestConfig.geminiMultimodalTimeoutMsSalvage ?? null,
      },
    });

    const usesGemini = requestConfig.analysisMode === "gemini" && requestConfig.analysisV2MultimodalEnabled;

    if (usesGemini) {
      if (!resumePlan.useIngestion) {
        const stageOk = await updateStage(analysis.id, leaseOwner, "ingestion");
        if (!stageOk) {
          logEvent("warn", "analysis_job_orphaned", {
            analysisId: analysis.id,
            videoId: analysis.youtubeVideoId,
            stage: "ingestion_start",
          });
          return;
        }

        ingestionPreflight = await preflightGeminiIngestion({ youtubeUrl, config: requestConfig });
        const saved = await completeStage(analysis.id, leaseOwner, {
          ingestionJson: JSON.stringify(ingestionPreflight),
          ...configUpdate,
        });
        if (saved.count === 0) {
          logEvent("warn", "analysis_job_orphaned", {
            analysisId: analysis.id,
            videoId: analysis.youtubeVideoId,
            stage: "ingestion_store",
          });
          return;
        }
      }

      if (ingestionPreflight && !ingestionPreflight.ok) {
        const message = ingestionPreflight.failureMessage ?? "Video ingestion preflight failed.";
        const updated = await prisma.videoAnalysis.updateMany({
          where: { id: analysis.id, leaseOwner },
          data: {
            status: "failed",
            failureReason: message,
            completedAt: new Date(),
            nextAttemptAt: null,
            diagnosticsJson: JSON.stringify({ ingestionPreflight }),
            idempotencyKey: null,
            leaseOwner: null,
            leaseExpiresAt: null,
            leaseHeartbeatAt: null,
            ...configUpdate,
          },
        });
        if (updated.count === 0) {
          logEvent("warn", "analysis_job_orphaned", {
            analysisId: analysis.id,
            videoId: analysis.youtubeVideoId,
            stage: "ingestion_preflight",
          });
          return;
        }
        logEvent("alert", "analysis_ingestion_failed", {
          analysisId: analysis.id,
          videoId: analysis.youtubeVideoId,
          attemptCount: analysis.attemptCount,
          analysisConfigHash: configSignature.hash,
          failureMessage: message,
        });
        return;
      }

      if (!resumePlan.useCore) {
        const stageOk = await updateStage(analysis.id, leaseOwner, "core");
        if (!stageOk) {
          logEvent("warn", "analysis_job_orphaned", {
            analysisId: analysis.id,
            videoId: analysis.youtubeVideoId,
            stage: "core_start",
          });
          return;
        }

        corePayload = await runMultimodalCore({ youtubeUrl, config: requestConfig });
        const saved = await completeStage(analysis.id, leaseOwner, {
          coreMetricsJson: JSON.stringify(corePayload),
          ...configUpdate,
        });
        if (saved.count === 0) {
          logEvent("warn", "analysis_job_orphaned", {
            analysisId: analysis.id,
            videoId: analysis.youtubeVideoId,
            stage: "core_store",
          });
          return;
        }
      }

      if (advancedMetricsEnabled && !resumePlan.useAdvanced) {
        if (!corePayload?.parsed) {
          throw new GeminiApiError("InvalidResponse", "Missing core analysis payload.");
        }

        const stageOk = await updateStage(analysis.id, leaseOwner, "advanced");
        if (!stageOk) {
          logEvent("warn", "analysis_job_orphaned", {
            analysisId: analysis.id,
            videoId: analysis.youtubeVideoId,
            stage: "advanced_start",
          });
          return;
        }

        advancedPayload = await runMultimodalAdvanced({
          youtubeUrl,
          config: requestConfig,
          coreParsed: corePayload.parsed,
        });
        const saved = await completeStage(analysis.id, leaseOwner, {
          advancedMetricsJson: JSON.stringify(advancedPayload),
          ...configUpdate,
        });
        if (saved.count === 0) {
          logEvent("warn", "analysis_job_orphaned", {
            analysisId: analysis.id,
            videoId: analysis.youtubeVideoId,
            stage: "advanced_store",
          });
          return;
        }
      }

      if (!corePayload?.parsed) {
        throw new GeminiApiError("InvalidResponse", "Missing core analysis payload.");
      }

      const multimodal = buildMultimodalResult({
        core: corePayload,
        advanced: advancedPayload ?? undefined,
      });

      const stageOk = await updateStage(analysis.id, leaseOwner, "performance");
      if (!stageOk) {
        logEvent("warn", "analysis_job_orphaned", {
          analysisId: analysis.id,
          videoId: analysis.youtubeVideoId,
          stage: "performance_start",
        });
        return;
      }

      const authContext = await getAuthContext();
      const analysisResult = await buildAnalysisFromMultimodal(
        {
          videoId: analysis.youtubeVideoId,
          title: analysis.title,
          durationSeconds: analysis.durationSeconds,
          creatorDisplayName: analysis.creator.displayName,
          channelId: analysis.creator.channelId ?? undefined,
        },
        multimodal,
        { config: requestConfig, auth: authContext ?? undefined },
      );

      const diagnosticsPayload = ingestionPreflight
        ? { ...analysisResult.diagnostics, ingestionPreflight }
        : analysisResult.diagnostics;

      const stageFinal = await updateStage(analysis.id, leaseOwner, "finalize");
      if (!stageFinal) {
        logEvent("warn", "analysis_job_orphaned", {
          analysisId: analysis.id,
          videoId: analysis.youtubeVideoId,
          stage: "finalize_start",
        });
        return;
      }

      const fingerprintJson = JSON.stringify(analysisResult.fingerprint);
      await prisma.videoAnalysis.update({
        where: { id: analysis.id },
        data: {
          analysisStage: "finalize",
          status: "complete",
          failureReason: null,
          completedAt: new Date(),
          stageCompletedAt: new Date(),
          nextAttemptAt: null,
          diagnosticsJson: JSON.stringify(diagnosticsPayload),
          idempotencyKey: null,
          leaseOwner: null,
          leaseExpiresAt: null,
          leaseHeartbeatAt: null,
          ...configUpdate,
          videoFingerprint: {
            upsert: {
              create: { fingerprint: fingerprintJson },
              update: { fingerprint: fingerprintJson },
            },
          },
        },
      });

      logEvent("info", "analysis_job_completed", {
        analysisId: analysis.id,
        videoId: analysis.youtubeVideoId,
        attemptCount: analysis.attemptCount,
        analysisConfigHash: configSignature.hash,
        durationMs: Date.now() - jobStart,
        coverage: analysisResult.diagnostics?.coverage,
        unobservedCounts: analysisResult.diagnostics?.unobservedCounts,
        salvage: analysisResult.diagnostics?.salvage,
        passMetrics: analysisResult.diagnostics?.passMetrics?.totals,
        advancedMetricsObserved: analysisResult.diagnostics?.advancedMetricsObserved ?? null,
      });
      return;
    }

    const stageOk = await updateStage(analysis.id, leaseOwner, "finalize");
    if (!stageOk) {
      logEvent("warn", "analysis_job_orphaned", {
        analysisId: analysis.id,
        videoId: analysis.youtubeVideoId,
        stage: "finalize_start",
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

    const diagnosticsPayload = ingestionPreflight
      ? { ...analysisResult.diagnostics, ingestionPreflight }
      : analysisResult.diagnostics;
    const fingerprintJson = JSON.stringify(analysisResult.fingerprint);

    await prisma.videoAnalysis.update({
      where: { id: analysis.id },
      data: {
        analysisStage: "finalize",
        status: "complete",
        failureReason: null,
        completedAt: new Date(),
        stageCompletedAt: new Date(),
        nextAttemptAt: null,
        diagnosticsJson: JSON.stringify(diagnosticsPayload),
        idempotencyKey: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        leaseHeartbeatAt: null,
        ...configUpdate,
        videoFingerprint: {
          upsert: {
            create: { fingerprint: fingerprintJson },
            update: { fingerprint: fingerprintJson },
          },
        },
      },
    });

    logEvent("info", "analysis_job_completed", {
      analysisId: analysis.id,
      videoId: analysis.youtubeVideoId,
      attemptCount: analysis.attemptCount,
      analysisConfigHash: configSignature.hash,
      durationMs: Date.now() - jobStart,
      coverage: analysisResult.diagnostics?.coverage,
      unobservedCounts: analysisResult.diagnostics?.unobservedCounts,
      salvage: analysisResult.diagnostics?.salvage,
      passMetrics: analysisResult.diagnostics?.passMetrics?.totals,
      advancedMetricsObserved: analysisResult.diagnostics?.advancedMetricsObserved ?? null,
    });
  } catch (error) {
    if (!analysis || !requestConfig || !configSignature) {
      console.error("Analysis job failed unexpectedly", error);
      return;
    }

    const message = resolveFailureMessage(error);
    const canRetry = shouldRetry(error);
    const maxAttempts = analysis.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

    if (canRetry && analysis.attemptCount < maxAttempts) {
      const delayMs = retryDelayMs(analysis.attemptCount);
      const nextAttemptAt = new Date(Date.now() + delayMs);
      const updated = await prisma.videoAnalysis.updateMany({
        where: { id: analysis.id, leaseOwner },
        data: {
          status: "pending",
          failureReason: message,
          nextAttemptAt,
          leaseOwner: null,
          leaseExpiresAt: null,
          leaseHeartbeatAt: null,
          analysisVersion: requestConfig.analysisVersion,
          analysisConfigHash: configSignature.hash,
          analysisConfigJson: configSignature.serialized,
          fingerprintSchemaVersion: FINGERPRINT_SCHEMA_VERSION,
          fingerprintSchemaHash: FINGERPRINT_SCHEMA_HASH,
        },
      });
      if (updated.count === 0) {
        logEvent("warn", "analysis_job_orphaned", {
          analysisId: analysis.id,
          videoId: analysis.youtubeVideoId,
          stage: "retry_update",
        });
        return;
      }
      logEvent("warn", "analysis_job_retry_scheduled", {
        analysisId: analysis.id,
        videoId: analysis.youtubeVideoId,
        attemptCount: analysis.attemptCount,
        maxAttempts,
        retryInMs: delayMs,
        failureMessage: message,
        analysisConfigHash: configSignature.hash,
      });
      return;
    }

    const updated = await prisma.videoAnalysis.updateMany({
      where: { id: analysis.id, leaseOwner },
      data: {
        status: "failed",
        failureReason: message,
        completedAt: new Date(),
        nextAttemptAt: null,
        idempotencyKey: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        leaseHeartbeatAt: null,
        analysisVersion: requestConfig.analysisVersion,
        analysisConfigHash: configSignature.hash,
        analysisConfigJson: configSignature.serialized,
        fingerprintSchemaVersion: FINGERPRINT_SCHEMA_VERSION,
        fingerprintSchemaHash: FINGERPRINT_SCHEMA_HASH,
      },
    });
    if (updated.count === 0) {
      logEvent("warn", "analysis_job_orphaned", {
        analysisId: analysis.id,
        videoId: analysis.youtubeVideoId,
        stage: "failed_update",
      });
      return;
    }
    logEvent("alert", "analysis_job_failed", {
      analysisId: analysis.id,
      videoId: analysis.youtubeVideoId,
      attemptCount: analysis.attemptCount,
      maxAttempts,
      failureMessage: message,
      analysisConfigHash: configSignature.hash,
    });
  } finally {
    stopHeartbeat();
  }
};
