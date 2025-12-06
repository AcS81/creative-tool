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
import type { DomainProfile, MetaAxes, VideoFingerprintJson } from "../types";
import { validateFingerprint } from "../schemas/fingerprint";
import { fetchVideoAnalytics } from "../youtube/analytics";
import { buildPerformanceTimeline } from "./performanceTimeline";
import { buildPerformanceProfile } from "./performanceProfile";
import type { AuthContext } from "../auth/context";

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

  if (useMock !== false) {
    return mockAnalyzeVideo(input);
  }

  const videoUrl = buildVideoUrl(input.videoId);
  const transcriptAndScenes = await getTranscriptAndScenes({ videoUrl }, { config });

  const domainInput = {
    transcriptSegments: transcriptAndScenes.transcriptSegments,
    sceneSegments: transcriptAndScenes.sceneSegments,
    videoUrl,
  };

  const [voiceProfile, languageProfile, narrativeProfile, visualProfile, editingProfile, soundProfile] =
    await Promise.all([
      analyzeVoice(domainInput, { config }),
      analyzeLanguage(domainInput, { config }),
      analyzeNarrative(domainInput, { config }),
      analyzeVisual(domainInput, { config }),
      analyzeEditing(domainInput, { config }),
      analyzeSound(domainInput, { config }),
    ]);

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
    supporting: {
      transcriptSegments: transcriptAndScenes.transcriptSegments,
      sceneSegments: transcriptAndScenes.sceneSegments,
    },
    hasPerformanceData: false,
  };

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
    } catch (error) {
      console.error("Performance analytics failed; continuing without performance data", error);
    }
  }

  const validated = validateFingerprint(fingerprint);

  return {
    fingerprint: validated,
    overallArchetype,
    diagnostics: { source: "gemini" },
  };
}
