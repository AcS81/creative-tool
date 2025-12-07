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

export async function analyzeVideo(
  input: AnalyzeVideoInput,
  options: AnalyzeOptions = {},
): Promise<AnalyzeVideoResult> {
  const config = options.config ?? getAppConfig();
  const useMock = options.useMock ?? config.analysisMode === "mock";
  const useMultimodal = config.analysisV2MultimodalEnabled === true;

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
  let multimodalDiagnostics: AnalyzeVideoResult["diagnostics"] | undefined;
  let analysisPath: AnalyzeVideoResult["diagnostics"]["analysisPath"] | undefined;
  let analysisErrorMessage: string | undefined;
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
      multimodalDiagnostics = {
        source: "gemini",
        performanceAttached: false,
        performanceErrorType: undefined,
        performanceErrorMessage: undefined,
        analysisVersion: "v2_multimodal",
        usedFallback: multimodal.diagnostics.fromFallback,
        unobservedCounts: multimodal.diagnostics.unobservedCounts,
        analysisPath: "gemini-v2-multimodal",
      };
      analysisPath = "gemini-v2-multimodal";
      ranMultimodal = true;
    } catch (error) {
      console.warn("Multimodal analysis failed; falling back to text-only path", error);
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
    multimodalDiagnostics = {
      ...(multimodalDiagnostics ?? {}),
      analysisVersion: "v1_text",
      analysisPath,
      analysisErrorMessage,
    };
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
    supporting: useMultimodal
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
      source: "gemini",
      performanceAttached,
      performanceErrorType,
      performanceErrorMessage,
      analysisPath,
      analysisErrorMessage,
      ...(multimodalDiagnostics ?? {}),
    },
  };
}
