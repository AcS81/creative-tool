import { ConfigError, getAppConfig, type AppConfig } from "../config";
import { mockAnalyzeVideo } from "./mock";
import type { AnalyzeVideoInput, AnalyzeVideoResult } from "./types";
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
import { analyzeVideoMultimodal } from "./geminiMultimodalAnalyzer";
import { buildDefaultAdvancedMetrics } from "./fingerprint/defaults";
import { buildVideoFingerprint, computeMetaAxesFromProfiles } from "./fingerprint/videoFingerprint";

type AnalyzeOptions = {
  config?: AppConfig;
  useMock?: boolean;
  auth?: AuthContext | null;
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
  const multimodal = await analyzeVideoMultimodal({ youtubeUrl: videoUrl, config });

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
  const multimodalFallbackUsed = Boolean(multimodal.diagnostics.fromFallback);

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
  const lowerConfidence = multimodalFallbackUsed;
  const lowerConfidenceReason = multimodalFallbackUsed
    ? "Gemini used inline fallback upload; measurements may be lower confidence."
    : undefined;

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

  const validated = validateFingerprint(fingerprint);

  return {
    fingerprint: validated,
    overallArchetype,
    diagnostics: {
      source: "gemini-v2-multimodal",
      performanceAttached,
      performanceErrorType,
      performanceErrorMessage,
      analysisPath: "gemini-v2-multimodal",
      analysisErrorMessage: undefined,
      analysisVersion: "v2",
      multimodalFallbackUsed,
      lowerConfidence,
      lowerConfidenceReason,
      unobservedCounts,
      coverage,
      salvage,
      advancedMetricsDefaulted,
      advancedMetricsObserved,
      advancedMetricsDefaultReason,
      advancedMetricsObservedBySection,
    },
  };
}
