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
import type { BeatSegment, DomainProfile, MetaAxes, VideoFingerprintJson, SceneSegment, TranscriptSegment } from "../types";
import { validateFingerprint } from "../schemas/fingerprint";
import { fetchVideoAnalytics } from "../youtube/analytics";
import { buildPerformanceTimeline } from "./performanceTimeline";
import { buildPerformanceProfile } from "./performanceProfile";
import type { AuthContext } from "../auth/context";
import { analyzeVideoMultimodal } from "./geminiMultimodalAnalyzer";

type AnalyzeOptions = {
  config?: AppConfig;
  useMock?: boolean;
  auth?: AuthContext | null;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const averageScore = (scores: DomainProfile["scores"]) =>
  scores.reduce((sum, score) => sum + score.value, 0) / Math.max(scores.length, 1);

const computeMetaAxes = (domains: {
  voice: DomainProfile;
  language: DomainProfile;
  narrative: DomainProfile;
  visual: DomainProfile;
  editing: DomainProfile;
  sound: DomainProfile;
}): MetaAxes => ({
  voiceIntensity: clamp(averageScore(domains.voice.scores)),
  conceptualDepth: clamp(averageScore(domains.language.scores)),
  narrativeStructureStrength: clamp(averageScore(domains.narrative.scores)),
  visualDynamism: clamp((averageScore(domains.visual.scores) + averageScore(domains.editing.scores)) / 2),
  productionPolish: clamp((averageScore(domains.editing.scores) + averageScore(domains.sound.scores)) / 2),
});

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
  let multimodalDiagnostics: AnalyzeVideoResult["diagnostics"] | undefined;
  let transcriptAndScenes:
    | {
        transcriptSegments: TranscriptSegment[];
        sceneSegments: SceneSegment[];
      }
    | undefined;

  if (useMultimodal) {
    const multimodal = await analyzeVideoMultimodal({ youtubeUrl: videoUrl, config });
    voiceProfile = multimodal.profiles.voice;
    languageProfile = multimodal.profiles.language;
    narrativeProfile = multimodal.profiles.narrative;
    visualProfile = multimodal.profiles.visual;
    editingProfile = multimodal.profiles.editing;
    soundProfile = multimodal.profiles.sound;
    beats = multimodal.beats;
    multimodalDiagnostics = {
      source: "gemini",
      performanceAttached: false,
      performanceErrorType: undefined,
      performanceErrorMessage: undefined,
      analysisVersion: "v2_multimodal",
      usedFallback: multimodal.diagnostics.fromFallback,
      unobservedCounts: multimodal.diagnostics.unobservedCounts,
    };
  } else {
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
  }

  const metaAxes = computeMetaAxes({
    voice: voiceProfile,
    language: languageProfile,
    narrative: narrativeProfile,
    visual: visualProfile,
    editing: editingProfile,
    sound: soundProfile,
  });

  const overallArchetype = archetypeForMeta(metaAxes);

  let fingerprint: VideoFingerprintJson = {
    version: "1.1.0",
    createdAt: new Date().toISOString(),
    metaAxes,
    perDomain: {
      voiceProfile,
      languageProfile,
      narrativeProfile,
      visualProfile,
      editingProfile,
      soundProfile,
    },
    overallArchetype,
    supporting: useMultimodal
      ? {
          beats,
        }
      : {
          transcriptSegments: transcriptAndScenes?.transcriptSegments,
          sceneSegments: transcriptAndScenes?.sceneSegments,
        },
    hasPerformanceData: false,
  };

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
      ...(multimodalDiagnostics ?? {}),
    },
  };
}
