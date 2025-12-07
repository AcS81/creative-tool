import type {
  AxisDetail,
  BeatSegment,
  DomainProfile,
  FingerprintPerDomain,
  MetaAxes,
  PerformanceProfile,
  SceneSegment,
  TranscriptSegment,
  VideoFingerprintJson,
} from "../../types";

type BuildFingerprintOptions = {
  version?: VideoFingerprintJson["version"];
  createdAt?: string;
  overallArchetype?: string;
  metaAxes?: MetaAxes;
  supporting?: {
    transcriptSegments?: TranscriptSegment[];
    sceneSegments?: SceneSegment[];
    beats?: BeatSegment[];
    axisDetails?: Record<string, AxisDetail>;
  };
  performanceProfile?: PerformanceProfile;
  hasPerformanceData?: boolean;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const averageScore = (scores: DomainProfile["scores"]) =>
  scores.reduce((sum, score) => sum + score.value, 0) / Math.max(scores.length, 1);

export const computeMetaAxesFromProfiles = (domains: FingerprintPerDomain): MetaAxes => ({
  voiceIntensity: clamp(averageScore(domains.voiceProfile.scores)),
  conceptualDepth: clamp(averageScore(domains.languageProfile.scores)),
  narrativeStructureStrength: clamp(averageScore(domains.narrativeProfile.scores)),
  visualDynamism: clamp(
    (averageScore(domains.visualProfile.scores) + averageScore(domains.editingProfile.scores)) / 2,
  ),
  productionPolish: clamp(
    (averageScore(domains.editingProfile.scores) + averageScore(domains.soundProfile.scores)) / 2,
  ),
});

export const buildVideoFingerprint = (
  perDomain: FingerprintPerDomain,
  options: BuildFingerprintOptions = {},
): VideoFingerprintJson => {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const version = options.version ?? "1.2.0";
  const metaAxes = options.metaAxes ?? computeMetaAxesFromProfiles(perDomain);

  return {
    version,
    createdAt,
    metaAxes,
    perDomain,
    overallArchetype: options.overallArchetype,
    supporting: options.supporting,
    performanceProfile: options.performanceProfile,
    hasPerformanceData: options.hasPerformanceData ?? Boolean(options.performanceProfile),
  };
};
