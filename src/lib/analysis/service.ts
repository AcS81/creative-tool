import { ConfigError, getAppConfig, type AppConfig } from "../config";
import { mockAnalyzeVideo } from "./mock";
import type { AnalyzeVideoInput, AnalyzeVideoResult, IngestionPreflight, PassResult } from "./types";
import type {
  MetaAxes,
  VideoFingerprintJson,
  FingerprintPerDomain,
  AdvancedFingerprintMetrics,
  ScoredMetric,
  BeatSegment,
  DomainProfile,
  DomainScore,
} from "../types";
import { validateFingerprint } from "../schemas/fingerprint";
import { fetchVideoAnalytics } from "../youtube/analytics";
import { buildPerformanceTimeline } from "./performanceTimeline";
import { buildPerformanceProfile } from "./performanceProfile";
import type { AuthContext } from "../auth/context";
import type { MultimodalAnalysisResult } from "./geminiMultimodalAnalyzer";
import { analyzeVideoMultimodal } from "./geminiMultimodalAnalyzer";
import { buildDefaultAdvancedMetrics } from "./fingerprint/defaults";
import { buildVideoFingerprint, computeMetaAxesFromProfiles } from "./fingerprint/videoFingerprint";
import { executeAdvancedPass, type AdvancedPassDiagnostics } from "./advancedPass";
import { planAdvancedAnalysis } from "./advancedPlanner";
import { isObservedMetric, mergeAdvancedSegments } from "./advancedMapping";
import { buildAdvancedPassConfig, buildAdvancedPlannerConfig, resolveAdvancedStrategy } from "./advancedStrategy";
import { buildFallbackSkeleton, runStructurePass } from "./structurePass";
import { buildFallbackCoreMetrics } from "./aggregation";
import type { SegmentAdvancedMetrics } from "./types/advancedMetrics";
import type { VideoSkeleton } from "./types/skeleton";
import { AnalysisError, type AnalysisErrorType } from "./errorHandling";
import { getAxesForDomain } from "./axisMetadata";
import type { DomainKey } from "../archetypes/descriptions";
import { buildPipelineDiagnostics } from "./pipelineDiagnostics";
import {
  computeMetaAxes,
  computeAlignmentScores,
  computeBalanceScores,
  computeCognitiveLoadScores,
  computeSecondOrderScores,
  buildFallbackDerivedScores,
} from "./derivedScores";
import type { DerivedScores } from "./types/derivedScores";
import type { CoreMetrics } from "./types/coreMetrics";
import { logEvent } from "../observability/logger";

type AnalyzeOptions = {
  config?: AppConfig;
  useMock?: boolean;
  auth?: AuthContext | null;
  ingestionPreflight?: IngestionPreflight;
  structurePass?: PassResult;
  skeleton?: VideoSkeleton;
  advancedMetrics?: SegmentAdvancedMetrics[];
  advancedDiagnostics?: AdvancedPassDiagnostics;
  advancedErrorMessage?: string;
  analysisErrors?: AnalysisError[];
  analysisWarnings?: string[];
  fallbacksUsed?: string[];
  overallSuccess?: boolean;
};

const archetypeForMeta = (meta: MetaAxes) => {
  if (meta.voiceIntensity > 70 && meta.visualDynamism > 65) return "Hyperactive Commentator";
  if (meta.conceptualDepth > 70 && meta.narrativeStructureStrength > 65) return "Reflective Analyst";
  if (meta.productionPolish > 75) return "Polished Host";
  return "Versatile Creator";
};

const fallbackScore = (key: string, label: string, value = 0): DomainScore => ({
  key,
  label,
  value,
});

const buildFallbackDomainProfile = (domain: DomainKey): DomainProfile => {
  const label = domain.charAt(0).toUpperCase() + domain.slice(1);
  const axes = getAxesForDomain(domain).slice(0, 3);
  const scores =
    axes.length > 0
      ? axes.map((axis) => fallbackScore(axis.id, axis.label))
      : [fallbackScore(`${domain}-axis`, `${label} Axis`, 0)];

  return {
    primaryArchetype: "Unavailable",
    secondaryArchetype: undefined,
    summaryText: `${label} analysis unavailable; showing fallback scores.`,
    scores,
    highlights: [],
    axisDetails: undefined,
  };
};

const buildFallbackProfiles = () => ({
  voice: buildFallbackDomainProfile("voice"),
  language: buildFallbackDomainProfile("language"),
  narrative: buildFallbackDomainProfile("narrative"),
  visual: buildFallbackDomainProfile("visual"),
  editing: buildFallbackDomainProfile("editing"),
  sound: buildFallbackDomainProfile("sound"),
});

const buildVideoUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;

const buildFallbackMultimodalResult = (skeleton: VideoSkeleton): MultimodalAnalysisResult => ({
  profiles: buildFallbackProfiles(),
  axisDetails: {},
  diagnostics: {
    unobservedCounts: {},
  },
  skeleton,
});

const extractScoredMetrics = (advanced: AdvancedFingerprintMetrics): ScoredMetric[] =>
  Object.values(advanced).flatMap((section) => Object.values(section ?? {}));

const mapKeyMomentRole = (type: string): BeatSegment["role"] => {
  const lower = type.toLowerCase();
  if (lower === "hook") return "hook";
  if (lower === "payoff") return "payoff";
  if (lower === "cta") return "cta";
  if (lower === "peak") return "escalation";
  if (lower === "twist") return "break";
  return undefined;
};

const buildBeatsFromSkeleton = (skeleton: VideoSkeleton): BeatSegment[] => {
  if (!skeleton.keyMoments || skeleton.keyMoments.length === 0) return [];
  const chapterMap = new Map(skeleton.chapters.map((chapter) => [chapter.id, chapter]));
  return skeleton.keyMoments.map((moment) => {
    const chapter = chapterMap.get(moment.chapterId);
    const startSeconds = moment.timestamp;
    const endSeconds = chapter ? Math.min(chapter.endSeconds, startSeconds + 1) : startSeconds + 1;
    return {
      label: moment.description || moment.type,
      role: mapKeyMomentRole(moment.type),
      startSeconds,
      endSeconds,
      devices: [],
    };
  });
};

const hasObservedAdvancedMetrics = (advanced?: AdvancedFingerprintMetrics) => {
  if (!advanced) return false;
  return extractScoredMetrics(advanced).some(isObservedMetric);
};

const hasObservedSection = (section: object | undefined) => {
  if (!section) return false;
  return Object.values(section as Record<string, ScoredMetric>).some(isObservedMetric);
};

const observedAdvancedSections = (advanced?: AdvancedFingerprintMetrics) =>
  !advanced
    ? undefined
    : {
        prosodyArc: hasObservedSection(advanced.prosodyArc),
        languageTexture: hasObservedSection(advanced.languageTexture),
        narrativeArc: hasObservedSection(advanced.narrativeArc),
        visualEditAlignment: hasObservedSection(advanced.visualEditAlignment),
        modalityBalance: hasObservedSection(advanced.modalityBalance),
        cognitiveLoad: hasObservedSection(advanced.cognitiveLoad),
        secondOrder: hasObservedSection(advanced.secondOrder),
      };


const buildAdvancedPassResult = (
  diagnostics: AdvancedPassDiagnostics,
  errorMessage?: string,
): PassResult => {
  const success =
    errorMessage === undefined &&
    (diagnostics.segmentsPlanned === 0 || diagnostics.segmentsCompleted > 0);
  const message =
    errorMessage ??
    (diagnostics.segmentsPlanned > 0 && diagnostics.segmentsCompleted === 0
      ? "No advanced segments completed."
      : undefined);
  return {
    success,
    durationMs: diagnostics.totalDurationMs,
    tokensUsed: 0,
    costUsd: diagnostics.estimatedCostUsd,
    retryCount: 0,
    errorMessage: message,
  };
};

const buildStructurePassDiagnostics = (input: {
  success: boolean;
  durationMs?: number;
  errorMessage?: string;
}): PassResult => ({
  success: input.success,
  durationMs: input.durationMs ?? 0,
  tokensUsed: 0,
  costUsd: 0,
  retryCount: 0,
  errorMessage: input.errorMessage,
});

const resolveStructureContext = (input: {
  skeleton?: VideoSkeleton;
  structurePass?: PassResult;
  durationSeconds?: number;
}): { skeleton: VideoSkeleton; structurePass: PassResult } => {
  if (input.skeleton && input.structurePass) {
    return { skeleton: input.skeleton, structurePass: input.structurePass };
  }

  const skeleton =
    input.skeleton ??
    buildFallbackSkeleton({
      durationSeconds: input.durationSeconds,
    });

  const structurePass =
    input.structurePass ??
    buildStructurePassDiagnostics({
      success: false,
      errorMessage: input.skeleton
        ? "Structure pass diagnostics missing; using provided skeleton."
        : "Structure pass not run; using fallback skeleton.",
    });

  return { skeleton, structurePass };
};

export async function buildAnalysisFromMultimodal(
  input: AnalyzeVideoInput,
  multimodal: MultimodalAnalysisResult,
  options: AnalyzeOptions = {},
): Promise<AnalyzeVideoResult> {
  const config = options.config ?? getAppConfig();
  const tieredMode = Boolean(multimodal.coreMetrics || multimodal.perChapterMetrics);
  const structureContext = resolveStructureContext({
    skeleton: options.skeleton,
    structurePass: options.structurePass,
    durationSeconds: input.durationSeconds,
  });
  const attachPerformance = async (currentFingerprint: VideoFingerprintJson) => {
    let fingerprint = currentFingerprint;
    let performanceAttached = false;
    let performanceErrorType: string | undefined;
    let performanceErrorMessage: string | undefined;

    if (config.performanceEnabled && options.auth?.userId && input.channelId) {
      try {
        const analytics = await fetchVideoAnalytics(
          { videoId: input.videoId, channelId: input.channelId, auth: options.auth },
          { config },
        );
        const timeline = buildPerformanceTimeline({
          retentionSeries: analytics.retentionSeries,
          beats: fingerprint.supporting?.beats,
          scenes: fingerprint.supporting?.sceneSegments,
          durationSeconds: input.durationSeconds,
        });
        const performanceProfile = buildPerformanceProfile({ analytics, timeline });
        fingerprint = {
          ...fingerprint,
          performanceProfile,
          hasPerformanceData: true,
        };
        performanceAttached = true;
      } catch (error) {
        console.error("Performance analytics failed; continuing without performance data", error);
        const err: any = error;
        if (err && typeof err === "object") {
          if (typeof err.type === "string") {
            performanceErrorType = err.type;
          }
          if (typeof err.message === "string") {
            performanceErrorMessage = err.message;
          }
        }
      }
    }

    return { fingerprint, performanceAttached, performanceErrorType, performanceErrorMessage };
  };

  const voiceProfile = multimodal.profiles.voice;
  const languageProfile = multimodal.profiles.language;
  const narrativeProfile = multimodal.profiles.narrative;
  const visualProfile = multimodal.profiles.visual;
  const editingProfile = multimodal.profiles.editing;
  const soundProfile = multimodal.profiles.sound;
  const beats =
    multimodal.beats && multimodal.beats.length > 0
      ? multimodal.beats
      : buildBeatsFromSkeleton(structureContext.skeleton);
  const axisDetails = multimodal.axisDetails;
  const unobservedCounts = multimodal.diagnostics.unobservedCounts;
  const coverage = multimodal.diagnostics.coverage;
  const salvage = multimodal.diagnostics.salvage;
  const passMetrics = multimodal.diagnostics.passMetrics;
  const analysisPath = tieredMode ? "gemini-v2-tiered" : "gemini-v2-multimodal";
  const advancedSegments = options.advancedMetrics;
  const advancedDiagnostics = options.advancedDiagnostics;
  const advancedErrorMessage = options.advancedErrorMessage;

  const perDomain: FingerprintPerDomain = {
    voiceProfile,
    languageProfile,
    narrativeProfile,
    visualProfile,
    editingProfile,
    soundProfile,
  };

  const metaAxes = computeMetaAxesFromProfiles(perDomain);
  const overallArchetype = archetypeForMeta(metaAxes);
  const advancedMetricsEnabled = config.advancedMetricsEnabled !== false;
  const advancedMetricsFromSegments =
    advancedSegments && advancedSegments.length > 0 ? mergeAdvancedSegments(advancedSegments) : undefined;
  const advancedMetricsFromAnalysis = advancedMetricsEnabled
    ? multimodal.advancedMetrics ?? advancedMetricsFromSegments
    : undefined;
  const advancedMetricsObserved = advancedMetricsEnabled && hasObservedAdvancedMetrics(advancedMetricsFromAnalysis);
  const advancedMetricsObservedBySection =
    advancedMetricsEnabled && advancedMetricsFromAnalysis ? observedAdvancedSections(advancedMetricsFromAnalysis) : undefined;
  const advancedMetricsDefaulted = !advancedMetricsEnabled || !advancedMetricsFromAnalysis;
  const advancedMetricsDefaultReason = !advancedMetricsDefaulted
    ? undefined
    : !advancedMetricsEnabled
      ? "Advanced metrics disabled via ENABLE_ADVANCED_METRICS=false."
      : advancedSegments
        ? advancedSegments.length === 0
          ? "Selective advanced pass returned no segments; using defaults."
          : "Selective advanced metrics unavailable; using defaults."
      : tieredMode
        ? "Tiered analysis currently returns core metrics only; using defaults for advanced metrics."
        : "Advanced metrics unavailable from Gemini; using defaults.";
  const advancedMetrics = advancedMetricsFromAnalysis ?? buildDefaultAdvancedMetrics();
  const advancedPass = advancedDiagnostics
    ? buildAdvancedPassResult(advancedDiagnostics, advancedErrorMessage)
    : undefined;

  // Build corePass PassResult from passMetrics
  const corePass: PassResult | undefined = passMetrics?.totals
    ? {
        success: true,
        durationMs: passMetrics.totals.durationMs ?? 0,
        tokensUsed: passMetrics.totals.usage?.totalTokens ?? 0,
        costUsd: passMetrics.totals.estimatedCostUsd ?? 0,
        retryCount: passMetrics.totals.retries ?? 0,
      }
    : passMetrics?.core
      ? {
          success: true,
          durationMs: passMetrics.core.durationMs ?? 0,
          tokensUsed: passMetrics.core.usage?.totalTokens ?? 0,
          costUsd: passMetrics.core.estimatedCostUsd ?? 0,
          retryCount: passMetrics.core.retries ?? 0,
        }
      : undefined;

  // Compute derived scores and track timing
  // Always run derived computation, even if core/advanced data is missing
  const derivedStart = Date.now();
  logEvent("info", "analysis_pass_start", {
    videoId: input.videoId,
    passName: "derived",
  });
  let derivedScores: DerivedScores | undefined;
  let derivedComputation: PassResult | undefined;
  const coreMetrics = multimodal.coreMetrics ?? buildFallbackCoreMetrics(structureContext.skeleton);
  
  try {
    const metaAxesComputed = computeMetaAxes(coreMetrics);
    const alignment = computeAlignmentScores(coreMetrics, advancedMetrics);
    const balance = computeBalanceScores(coreMetrics, structureContext.skeleton);
    const cognitiveLoad = computeCognitiveLoadScores(coreMetrics, advancedMetrics);
    const secondOrder = computeSecondOrderScores({
      core: coreMetrics,
      alignment,
      balance,
      cognitiveLoad,
      advanced: advancedMetrics,
    });

    derivedScores = {
      metaAxes: metaAxesComputed,
      alignment,
      balance,
      cognitiveLoad,
      secondOrder,
    };

    const derivedDuration = Date.now() - derivedStart;
    derivedComputation = {
      success: true,
      durationMs: derivedDuration,
      tokensUsed: 0, // Local computation, no tokens
      costUsd: 0, // Local computation, no cost
      retryCount: 0,
    };
    logEvent("info", "analysis_pass_complete", {
      videoId: input.videoId,
      passName: "derived",
      success: true,
      durationMs: derivedDuration,
      tokensUsed: 0,
      costUsd: 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Derived scores computation failed.";
    const errorDetails = error instanceof Error ? { errorType: error.name, errorMessage: error.message } : {};
    const derivedDuration = Date.now() - derivedStart;
    logEvent("error", "analysis_pass_failed", {
      videoId: input.videoId,
      passName: "derived",
      durationMs: derivedDuration,
      errorMessage: message,
      ...errorDetails,
    });
    console.error("Derived scores computation failed", error);
    // Use fallback derived scores on error
    derivedScores = buildFallbackDerivedScores();
    derivedComputation = {
      success: false,
      durationMs: derivedDuration,
      tokensUsed: 0,
      costUsd: 0,
      retryCount: 0,
      errorMessage: message,
    };
  }

  // Build advanced passes array from advancedPass
  const advancedPasses: PassResult[] = advancedPass ? [advancedPass] : [];

  // Build PipelineDiagnostics
  const pipelineDiagnostics = buildPipelineDiagnostics({
    structurePass: structureContext.structurePass,
    corePass,
    advancedPasses,
    derivedComputation,
    coreMetrics,
    advancedMetrics: advancedSegments,
    derivedScores,
    tier2Config: advancedDiagnostics
      ? {
          advancedSchemaStrategy: config.advancedSchemaStrategy,
          advancedResponseFormat: config.advancedResponseFormat,
          schemaRejectionCount: 0, // TODO: Track schema rejections from advanced pass
          timelineInterpolated: config.advancedResponseFormat === "compact",
        }
      : undefined,
  });

  let fingerprint: VideoFingerprintJson = buildVideoFingerprint(perDomain, {
    metaAxes,
    overallArchetype,
    supporting: {
      beats,
      axisDetails,
      perChapterMetrics: multimodal.perChapterMetrics as Array<Record<string, unknown>> | undefined,
      advancedSegments: advancedSegments as Array<Record<string, unknown>> | undefined,
    },
    hasPerformanceData: false,
    advancedMetrics,
    derivedScores,
  });

  const performance = await attachPerformance(fingerprint);
  fingerprint = performance.fingerprint;

  const validated = validateFingerprint(fingerprint);

  return {
    fingerprint: validated,
    skeleton: structureContext.skeleton,
    advancedMetrics: advancedSegments,
    overallArchetype,
    diagnostics: {
      source: analysisPath,
      structurePass: structureContext.structurePass,
      corePass: pipelineDiagnostics.corePass,
      advancedPass,
      advancedPasses: pipelineDiagnostics.advancedPasses,
      derivedComputation: pipelineDiagnostics.derivedComputation,
      overallCoverage: pipelineDiagnostics.overallCoverage,
      totalCostUsd: pipelineDiagnostics.totalCostUsd,
      totalDurationMs: pipelineDiagnostics.totalDurationMs,
      tier2Config: pipelineDiagnostics.tier2Config,
      performanceAttached: performance.performanceAttached,
      performanceErrorType: performance.performanceErrorType,
      performanceErrorMessage: performance.performanceErrorMessage,
      analysisPath,
      analysisErrorMessage: undefined,
      analysisVersion: "v2",
      unobservedCounts,
      coverage,
      salvage,
      passMetrics,
      advancedMetricsDefaulted,
      advancedMetricsObserved,
      advancedMetricsDefaultReason,
      advancedMetricsObservedBySection,
      errors: options.analysisErrors,
      warnings: options.analysisWarnings,
      fallbacksUsed: options.fallbacksUsed,
      overallSuccess: options.overallSuccess,
    },
  };
}

export async function analyzeVideo(
  input: AnalyzeVideoInput,
  options: AnalyzeOptions = {},
): Promise<AnalyzeVideoResult> {
  const config = options.config ?? getAppConfig();
  const useMock = options.useMock ?? config.analysisMode === "mock";

  if (useMock !== false) {
    return mockAnalyzeVideo(input);
  }

  if (config.analysisMode !== "gemini" || config.analysisV2MultimodalEnabled === false) {
    throw new ConfigError("Multimodal analysis is required; set ANALYSIS_MODE=gemini and ENABLE_ANALYSIS_V2_MULTIMODAL=true.");
  }

  if (config.analysisVersion === "v1") {
    throw new ConfigError("ANALYSIS_VERSION=v1 is no longer supported; v2 multimodal is canonical.");
  }

  const analysisErrors: AnalysisError[] = [];
  const analysisWarnings: string[] = [];
  const fallbacksUsed: string[] = [];

  const recordError = (input: {
    type: AnalysisErrorType;
    message: string;
    recoverable: boolean;
    fallbackAvailable: boolean;
    cause?: unknown;
  }) => {
    const error = new AnalysisError(input);
    analysisErrors.push(error);
    return error;
  };

  const recordFallback = (label: string, warning?: string) => {
    if (!fallbacksUsed.includes(label)) {
      fallbacksUsed.push(label);
    }
    if (warning) {
      analysisWarnings.push(warning);
    }
  };

  const videoUrl = buildVideoUrl(input.videoId);
  const structureStart = Date.now();
  logEvent("info", "analysis_pass_start", {
    videoId: input.videoId,
    passName: "structure",
    durationSeconds: input.durationSeconds,
  });
  let structureResult;
  let structureErrorHandled = false;
  try {
    structureResult = await runStructurePass(
      {
        youtubeUrl: videoUrl,
        durationSeconds: input.durationSeconds,
      },
      {
        config,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Structure pass failed.";
    const errorDetails = error instanceof Error ? { errorType: error.name, errorMessage: error.message } : {};
    logEvent("error", "analysis_pass_failed", {
      videoId: input.videoId,
      passName: "structure",
      errorMessage: message,
      ...errorDetails,
    });
    console.error("Structure pass failed; using fallback.", { videoId: input.videoId, error });
    recordError({
      type: "structure",
      message,
      recoverable: true,
      fallbackAvailable: true,
      cause: error,
    });
    recordFallback("structurePass", message);
    structureErrorHandled = true;
    structureResult = {
      skeleton: buildFallbackSkeleton({
        durationSeconds: input.durationSeconds,
      }),
      source: "fallback" as const,
      error: message,
    };
  }
  if (structureResult.source === "fallback" && !structureErrorHandled) {
    const message = structureResult.error ?? "Structure pass used fallback.";
    logEvent("warn", "analysis_fallback_used", {
      videoId: input.videoId,
      passName: "structure",
      reason: message,
    });
    recordError({
      type: "structure",
      message,
      recoverable: true,
      fallbackAvailable: true,
    });
    recordFallback("structurePass", message);
  }
  const structureDuration = Date.now() - structureStart;
  const structurePass = buildStructurePassDiagnostics({
    success: structureResult.source === "gemini",
    durationMs: structureDuration,
    errorMessage: structureResult.error,
  });
  logEvent("info", "analysis_pass_complete", {
    videoId: input.videoId,
    passName: "structure",
    success: structurePass.success,
    durationMs: structureDuration,
    tokensUsed: structurePass.tokensUsed,
    costUsd: structurePass.costUsd,
    retryCount: structurePass.retryCount,
    errorMessage: structurePass.errorMessage,
  });
  let multimodal: MultimodalAnalysisResult;
  let multimodalSuccess = true;
  const coreStart = Date.now();
  logEvent("info", "analysis_pass_start", {
    videoId: input.videoId,
    passName: "core",
    tieredMode: config.useTieredAnalysis ?? false,
  });
  try {
    multimodal = await analyzeVideoMultimodal({
      youtubeUrl: videoUrl,
      config,
      useTieredAnalysis: config.useTieredAnalysis,
      skeleton: structureResult.skeleton,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Multimodal analysis failed.";
    const errorDetails = error instanceof Error ? { errorType: error.name, errorMessage: error.message } : {};
    const coreDuration = Date.now() - coreStart;
    logEvent("error", "analysis_pass_failed", {
      videoId: input.videoId,
      passName: "core",
      durationMs: coreDuration,
      errorMessage: message,
      ...errorDetails,
    });
    logEvent("warn", "analysis_fallback_used", {
      videoId: input.videoId,
      passName: "core",
      reason: message,
    });
    console.error("Multimodal analysis failed; using fallback profiles.", {
      videoId: input.videoId,
      error,
    });
    recordError({
      type: "core",
      message,
      recoverable: true,
      fallbackAvailable: true,
      cause: error,
    });
    recordFallback("corePass", message);
    multimodalSuccess = false;
    multimodal = buildFallbackMultimodalResult(structureResult.skeleton);
  }
  const coreDuration = Date.now() - coreStart;
  const passMetrics = multimodal.diagnostics.passMetrics;
  const coreMetrics = multimodal.coreMetrics;
  if (coreMetrics && passMetrics?.totals) {
    logEvent("info", "analysis_pass_complete", {
      videoId: input.videoId,
      passName: "core",
      success: true,
      durationMs: coreDuration,
      tokensUsed: passMetrics.totals.usage?.totalTokens ?? 0,
      costUsd: passMetrics.totals.estimatedCostUsd ?? 0,
      retryCount: passMetrics.totals.retries ?? 0,
    });
  } else if (coreMetrics) {
    logEvent("info", "analysis_pass_complete", {
      videoId: input.videoId,
      passName: "core",
      success: true,
      durationMs: coreDuration,
    });
  }
  const advancedMetricsEnabled =
    (config.multimodalPassMode ?? "full") !== "core" && config.advancedMetricsEnabled !== false;
  let advancedSegments: SegmentAdvancedMetrics[] | undefined;
  let advancedDiagnostics: AdvancedPassDiagnostics | undefined;
  let advancedErrorMessage: string | undefined;

  if (config.useTieredAnalysis && advancedMetricsEnabled && multimodalSuccess) {
    const coreMetrics = multimodal.coreMetrics ?? buildFallbackCoreMetrics(structureResult.skeleton);
    const perChapterMetrics = multimodal.perChapterMetrics ?? [];
    const durationSeconds = structureResult.skeleton.durationSeconds || input.durationSeconds;
    const advancedStrategy = resolveAdvancedStrategy(durationSeconds);
    const plannerConfig = buildAdvancedPlannerConfig(config, advancedStrategy);
    const plan = planAdvancedAnalysis(structureResult.skeleton, {
      aggregated: coreMetrics,
      perChapterMetrics,
    }, plannerConfig);
    const passConfig = buildAdvancedPassConfig(config, advancedStrategy);
    const advancedStartedAt = Date.now();
    const schemaStrategy = config.advancedSchemaStrategy ?? "inherit";
    const responseFormat = config.advancedResponseFormat ?? "full";

    logEvent("info", "analysis_pass_start", {
      videoId: input.videoId,
      passName: "advanced",
      segmentsPlanned: plan.segments.length,
      advancedSchemaStrategy: schemaStrategy,
      advancedResponseFormat: responseFormat,
      timelineInterpolated: responseFormat === "compact",
    });

    try {
      const advancedResult = await executeAdvancedPass(plan, {
        youtubeUrl: videoUrl,
        skeleton: structureResult.skeleton,
        config,
      }, passConfig);
      advancedSegments = advancedResult.segments;
      advancedDiagnostics = advancedResult.diagnostics;

      const advancedDuration = Date.now() - advancedStartedAt;
      // Log compact mode metrics if available
      const compactMetrics: Record<string, unknown> = {};
      if (responseFormat === "compact" && advancedSegments) {
        for (const segment of advancedSegments) {
          if (segment.diagnostics) {
            const diagnostics = segment.diagnostics as Record<string, unknown>;
            if (diagnostics.interpolation) {
              const interpolation = diagnostics.interpolation as Record<string, { anchorCount?: number; timelinePoints?: number }>;
              for (const [metric, data] of Object.entries(interpolation)) {
                if (data.anchorCount !== undefined) {
                  compactMetrics[`${segment.segmentId}_${metric}_anchors`] = data.anchorCount;
                }
                if (data.timelinePoints !== undefined) {
                  compactMetrics[`${segment.segmentId}_${metric}_timelinePoints`] = data.timelinePoints;
                }
              }
            }
          }
        }
      }

      logEvent("info", "analysis_pass_complete", {
        videoId: input.videoId,
        passName: "advanced",
        success: true,
        durationMs: advancedDuration,
        segmentsPlanned: advancedDiagnostics.segmentsPlanned,
        segmentsCompleted: advancedDiagnostics.segmentsCompleted,
        segmentsFailed: advancedDiagnostics.segmentsFailed,
        costUsd: advancedDiagnostics.estimatedCostUsd,
        advancedSchemaStrategy: schemaStrategy,
        advancedResponseFormat: responseFormat,
        timelineInterpolated: responseFormat === "compact",
        ...compactMetrics,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Selective advanced pass failed.";
      const errorDetails = error instanceof Error ? { errorType: error.name, errorMessage: error.message } : {};
      const advancedDuration = Date.now() - advancedStartedAt;
      logEvent("error", "analysis_pass_failed", {
        videoId: input.videoId,
        passName: "advanced",
        durationMs: advancedDuration,
        errorMessage: message,
        ...errorDetails,
      });
      logEvent("warn", "analysis_fallback_used", {
        videoId: input.videoId,
        passName: "advanced",
        reason: message,
      });
      console.error("Selective advanced pass failed; continuing without advanced metrics", error);
      recordError({
        type: "advanced",
        message,
        recoverable: true,
        fallbackAvailable: true,
        cause: error,
      });
      recordFallback("advancedPass", message);
      advancedSegments = [];
      advancedDiagnostics = {
        segmentsPlanned: plan.segments.length,
        segmentsCompleted: 0,
        segmentsFailed: plan.segments.length,
        totalDurationMs: advancedDuration,
        estimatedCostUsd: 0,
      };
      advancedErrorMessage = message;
    }
  }
  const overallSuccess =
    multimodalSuccess || structureResult.source === "gemini" || fallbacksUsed.length > 0;
  return buildAnalysisFromMultimodal(input, multimodal, {
    ...options,
    skeleton: structureResult.skeleton,
    structurePass,
    advancedMetrics: advancedSegments,
    advancedDiagnostics,
    advancedErrorMessage,
    analysisErrors,
    analysisWarnings,
    fallbacksUsed,
    overallSuccess,
  });
}
