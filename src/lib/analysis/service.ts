import { getAppConfig, type AppConfig } from "../config";
import { mockAnalyzeVideo } from "./mock";
import type { AnalyzeVideoInput, AnalyzeVideoResult } from "./types";
import { getTranscriptAndScenes } from "../gemini/client";
import {
  analyzeEditing,
  analyzeLanguage,
  analyzeNarrative,
  analyzeSound,
  analyzeVisual,
  analyzeVoice,
} from "./geminiDomains";
import type {
  AxisDetail,
  BeatSegment,
  DomainProfile,
  MetaAxes,
  VideoFingerprintJson,
  SceneSegment,
  TranscriptSegment,
  FingerprintPerDomain,
} from "../types";
import { validateFingerprint } from "../schemas/fingerprint";
import { fetchVideoAnalytics } from "../youtube/analytics";
import { buildPerformanceTimeline } from "./performanceTimeline";
import { buildPerformanceProfile } from "./performanceProfile";
import type { AuthContext } from "../auth/context";
import { analyzeVideoMultimodal } from "./geminiMultimodalAnalyzer";
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

const isUnsupportedMultimodalError = (error: unknown) => {
  const code = (error as any)?.code;
  const status = (error as any)?.status as number | undefined;
  return (
    code === "FEATURE_DISABLED" ||
    code === "CONFIG_MISSING" ||
    code === "INVALID_URL" ||
    code === "FALLBACK_FAILED" ||
    status === 403
  );
};

export async function analyzeVideo(
  input: AnalyzeVideoInput,
  options: AnalyzeOptions = {},
): Promise<AnalyzeVideoResult> {
  const config = options.config ?? getAppConfig();
  const useMock = options.useMock ?? config.analysisMode === "mock";
  const rolloutForcesV1 = config.analysisVersion === "v1" || config.analysisV2MultimodalEnabled === false;
  const useMultimodal =
    config.analysisMode === "gemini" && config.analysisV2MultimodalEnabled !== false && !rolloutForcesV1;

  if (useMock !== false) {
    return mockAnalyzeVideo(input);
  }

  const videoUrl = buildVideoUrl(input.videoId);
  let voiceProfile: DomainProfile;
  let languageProfile: DomainProfile;
  let narrativeProfile: DomainProfile;
  let visualProfile: DomainProfile;
  let editingProfile: DomainProfile;
  let soundProfile: DomainProfile;
  let beats: BeatSegment[] | undefined;
  let axisDetails: Record<string, AxisDetail> | undefined;
  let analysisPath: AnalyzeVideoResult["diagnostics"]["analysisPath"] | undefined;
  let analysisErrorMessage: string | undefined;
  let analysisVersionUsed: AnalyzeVideoResult["diagnostics"]["analysisVersion"] | undefined;
  let unobservedCounts: Record<string, number> | undefined;
  let multimodalFallbackUsed = false;
  let transcriptAndScenes:
    | {
        transcriptSegments: TranscriptSegment[];
        sceneSegments: SceneSegment[];
      }
    | undefined;

  let ranMultimodal = false;

  if (useMultimodal) {
    try {
      const multimodal = await analyzeVideoMultimodal({ youtubeUrl: videoUrl, config });
      voiceProfile = multimodal.profiles.voice;
      languageProfile = multimodal.profiles.language;
      narrativeProfile = multimodal.profiles.narrative;
      visualProfile = multimodal.profiles.visual;
      editingProfile = multimodal.profiles.editing;
      soundProfile = multimodal.profiles.sound;
      beats = multimodal.beats;
      axisDetails = multimodal.axisDetails;
      analysisPath = "gemini-v2-multimodal";
      analysisVersionUsed = "v2";
      multimodalFallbackUsed = Boolean(multimodal.diagnostics.fromFallback);
      unobservedCounts = multimodal.diagnostics.unobservedCounts;
      ranMultimodal = true;
    } catch (error) {
      const canFallback = isUnsupportedMultimodalError(error);
      if (!canFallback) {
        throw error;
      }
      console.warn("Multimodal analysis unavailable; falling back to text-only path", error);
      analysisErrorMessage = error instanceof Error ? error.message : "Unknown multimodal error";
    }
  }

  if (!ranMultimodal) {
    transcriptAndScenes = await getTranscriptAndScenes({ videoUrl }, { config });

    const domainInput = {
      transcriptSegments: transcriptAndScenes.transcriptSegments,
      sceneSegments: transcriptAndScenes.sceneSegments,
      videoUrl,
    };

    const results = await Promise.all([
      analyzeVoice(domainInput, { config }),
      analyzeLanguage(domainInput, { config }),
      analyzeNarrative(domainInput, { config }),
      analyzeVisual(domainInput, { config }),
      analyzeEditing(domainInput, { config }),
      analyzeSound(domainInput, { config }),
    ]);

    [voiceProfile, languageProfile, narrativeProfile, visualProfile, editingProfile, soundProfile] = results;
    analysisPath = "gemini-v1-text";
    analysisVersionUsed = "v1";
  }

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

  let fingerprint: VideoFingerprintJson = buildVideoFingerprint(perDomain, {
    metaAxes,
    overallArchetype,
    supporting:
      analysisPath === "gemini-v2-multimodal"
        ? {
            beats,
            axisDetails,
          }
        : {
            transcriptSegments: transcriptAndScenes?.transcriptSegments,
            sceneSegments: transcriptAndScenes?.sceneSegments,
          },
    hasPerformanceData: false,
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
      source: analysisPath ?? "gemini-v1-text",
      performanceAttached,
      performanceErrorType,
      performanceErrorMessage,
      analysisPath,
      analysisErrorMessage,
      analysisVersion: analysisVersionUsed ?? (analysisPath === "gemini-v2-multimodal" ? "v2" : "v1"),
      multimodalFallbackUsed,
      unobservedCounts,
    },
  };
}
