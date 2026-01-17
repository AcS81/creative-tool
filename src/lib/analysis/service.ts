import { ConfigError, getAppConfig, type AppConfig } from "../config";
import { mockAnalyzeVideo } from "./mock";
import type { AnalyzeVideoInput, AnalyzeVideoResult, IngestionPreflight, PassResult } from "./types";
import type {
  MetaAxes,
  VideoFingerprintJson,
  FingerprintPerDomain,
  AdvancedFingerprintMetrics,
  ScoredMetric,
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
import { buildFallbackSkeleton, runStructurePass } from "./structurePass";
import type { VideoSkeleton } from "./types/skeleton";

type AnalyzeOptions = {
  config?: AppConfig;
  useMock?: boolean;
  auth?: AuthContext | null;
  ingestionPreflight?: IngestionPreflight;
  structurePass?: PassResult;
  skeleton?: VideoSkeleton;
};

const archetypeForMeta = (meta: MetaAxes) => {
  if (meta.voiceIntensity > 70 && meta.visualDynamism > 65) return "Hyperactive Commentator";
  if (meta.conceptualDepth > 70 && meta.narrativeStructureStrength > 65) return "Reflective Analyst";
  if (meta.productionPolish > 75) return "Polished Host";
  return "Versatile Creator";
};

const buildVideoUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;

const extractScoredMetrics = (advanced: AdvancedFingerprintMetrics): ScoredMetric[] =>
  Object.values(advanced).flatMap((section) => Object.values(section ?? {}));

const hasObservedAdvancedMetrics = (advanced?: AdvancedFingerprintMetrics) => {
  if (!advanced) return false;
  return extractScoredMetrics(advanced).some((metric) => {
    if (!metric) return false;
    const value = typeof metric.value === "string" ? metric.value.trim().toLowerCase() : "";
    const hasValue = value !== "" && value !== "unobserved";
    const hasScore = typeof metric.score === "number" && metric.score > 0;
    return metric.observed === true || hasValue || hasScore;
  });
};

const hasObservedSection = (section: Record<string, ScoredMetric> | undefined) => {
  if (!section) return false;
  return Object.values(section).some((metric) => {
    if (!metric) return false;
    const value = typeof metric.value === "string" ? metric.value.trim().toLowerCase() : "";
    const hasValue = value !== "" && value !== "unobserved";
    const hasScore = typeof metric.score === "number" && metric.score > 0;
    return metric.observed === true || hasValue || hasScore;
  });
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
  const beats = multimodal.beats;
  const axisDetails = multimodal.axisDetails;
  const unobservedCounts = multimodal.diagnostics.unobservedCounts;
  const coverage = multimodal.diagnostics.coverage;
  const salvage = multimodal.diagnostics.salvage;
  const passMetrics = multimodal.diagnostics.passMetrics;

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
  const advancedMetricsFromAnalysis = advancedMetricsEnabled ? multimodal.advancedMetrics : undefined;
  const advancedMetricsObserved = advancedMetricsEnabled && hasObservedAdvancedMetrics(advancedMetricsFromAnalysis);
  const advancedMetricsObservedBySection =
    advancedMetricsEnabled && advancedMetricsFromAnalysis ? observedAdvancedSections(advancedMetricsFromAnalysis) : undefined;
  const advancedMetricsDefaulted = !advancedMetricsEnabled || !advancedMetricsFromAnalysis;
  const advancedMetricsDefaultReason = !advancedMetricsDefaulted
    ? undefined
    : !advancedMetricsEnabled
      ? "Advanced metrics disabled via ENABLE_ADVANCED_METRICS=false."
      : "Advanced metrics unavailable from Gemini; using defaults.";
  const advancedMetrics = advancedMetricsFromAnalysis ?? buildDefaultAdvancedMetrics();
  let fingerprint: VideoFingerprintJson = buildVideoFingerprint(perDomain, {
    metaAxes,
    overallArchetype,
    supporting: {
      beats,
      axisDetails,
    },
    hasPerformanceData: false,
    advancedMetrics,
  });

  const performance = await attachPerformance(fingerprint);
  fingerprint = performance.fingerprint;

  const validated = validateFingerprint(fingerprint);

  return {
    fingerprint: validated,
    skeleton: structureContext.skeleton,
    overallArchetype,
    diagnostics: {
      source: "gemini-v2-multimodal",
      structurePass: structureContext.structurePass,
      performanceAttached: performance.performanceAttached,
      performanceErrorType: performance.performanceErrorType,
      performanceErrorMessage: performance.performanceErrorMessage,
      analysisPath: "gemini-v2-multimodal",
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

  const videoUrl = buildVideoUrl(input.videoId);
  const structureStart = Date.now();
  const structureResult = await runStructurePass({
    youtubeUrl: videoUrl,
    durationSeconds: input.durationSeconds,
  }, {
    config,
  });
  const structurePass = buildStructurePassDiagnostics({
    success: structureResult.source === "gemini",
    durationMs: Date.now() - structureStart,
    errorMessage: structureResult.error,
  });
  const multimodal = await analyzeVideoMultimodal({ youtubeUrl: videoUrl, config });
  return buildAnalysisFromMultimodal(input, multimodal, {
    ...options,
    skeleton: structureResult.skeleton,
    structurePass,
  });
}
