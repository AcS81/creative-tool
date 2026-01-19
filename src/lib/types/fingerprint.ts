export type CreatorType = "user" | "reference";

export interface CreatorProfile {
  id: string;
  type: CreatorType;
  displayName: string;
  channelId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type AnalysisStatus = "pending" | "complete" | "failed";

export interface VideoAnalysis {
  id: string;
  creatorId: string;
  youtubeVideoId: string;
  title?: string;
  durationSeconds?: number;
  status: AnalysisStatus;
  failureReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AxisScore {
  key: string;
  label: string;
  value: number;
}

export interface AxisDetail {
  rawValue: string;
  explanation?: string;
  observed?: boolean;
}

export type TimelinePoint = {
  timeSeconds: number;
  value: number;
  label?: string;
};

export type SpanHighlight = {
  startSeconds: number;
  endSeconds: number;
  value?: number;
  label?: string;
  alignedBeat?: string;
  alignedPunchline?: boolean;
};

export type SegmentDelta = {
  startSeconds: number;
  endSeconds: number;
  deltaPct?: number;
  label?: string;
};

export type ScoredMetric = {
  score: number;
  value?: string;
  observed?: boolean;
  timeline?: TimelinePoint[];
  spans?: SpanHighlight[];
  segments?: SegmentDelta[];
  items?: Record<string, unknown>[];
  proportions?: Record<string, number>;
  counts?: Record<string, number>;
  trend?: number;
};

export type DomainScore = AxisScore;

export interface DomainProfile {
  primaryArchetype: string;
  secondaryArchetype?: string;
  summaryText: string;
  scores: DomainScore[];
  highlights?: string[];
  axisDetails?: Record<string, AxisDetail>;
}

export interface MetaAxes {
  voiceIntensity: number;
  conceptualDepth: number;
  narrativeStructureStrength: number;
  visualDynamism: number;
  productionPolish: number;
}

export interface FingerprintPerDomain {
  voiceProfile: DomainProfile;
  languageProfile: DomainProfile;
  narrativeProfile: DomainProfile;
  visualProfile: DomainProfile;
  editingProfile: DomainProfile;
  soundProfile: DomainProfile;
}

export interface TranscriptSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface SceneSegment {
  startSeconds: number;
  endSeconds: number;
  label: string;
  shortSummary: string;
}

export type BeatRole = "hook" | "setup" | "escalation" | "payoff" | "outro" | "cta" | "break";

export interface BeatSegment {
  startSeconds: number;
  endSeconds: number;
  label: string;
  role?: BeatRole;
  devices: string[];
}

export interface RetentionPoint {
  timeRatio: number; // 0-1 ratio of video progress
  audienceRetention: number; // normalized percentage 0-100
  beatLabel?: string;
  beatRole?: BeatRole;
  sceneLabel?: string;
}

export interface PerformanceScores {
  hookRetention: number;
  midVideoRetentionStability: number;
  lateDropOffSeverity: number;
  clickThroughRateQuality: number;
}

export interface PerformanceMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  ctr?: number;
  avgViewDurationSeconds?: number;
  retentionSeries?: RetentionPoint[];
}

export interface PerformanceProfile {
  scores: PerformanceScores;
  metrics: PerformanceMetrics;
  summaryText: string;
  insights?: string[];
}

export interface ProsodyArc {
  paceMeanWpm: ScoredMetric;
  paceVariabilityPct: ScoredMetric;
  withinSegmentPaceChangePct: ScoredMetric;
  emphasisAlignmentScore: ScoredMetric;
  energyDriftDbPerMin: ScoredMetric;
}

export interface LanguageTexture {
  analogyExampleDefinitionRatio: ScoredMetric;
  sentenceCompressionRatio: ScoredMetric;
  humorTimingScore: ScoredMetric;
  referenceDensityPerMin: ScoredMetric;
  questionRate: ScoredMetric;
  audienceAddressFrequency: ScoredMetric;
}

export interface NarrativeArc {
  timeToHookSeconds: ScoredMetric;
  hookStrengthScore: ScoredMetric;
  segmentCohesionDrift: ScoredMetric;
  openLoopsUnresolvedRatio: ScoredMetric;
  endingResolutionScore: ScoredMetric;
}

export interface VisualEditAlignment {
  visualEntropy: ScoredMetric;
  cutRateRefinement: ScoredMetric;
  silenceForEmphasisFidelity: ScoredMetric;
  audioVisualEmphasisAlignment: ScoredMetric;
  beatsVsEditsAlignment: ScoredMetric;
  prosodyVsSemanticImportanceAlignment: ScoredMetric;
}

export interface ModalityBalance {
  redundancyVsComplementarity: ScoredMetric;
  modalityOverReliance: ScoredMetric;
}

export interface CognitiveLoad {
  loadPerSecond: ScoredMetric;
  loadHighlights: ScoredMetric;
}

export interface SecondOrderSummary {
  alignmentScore: ScoredMetric;
  driftScore: ScoredMetric;
  decayScore: ScoredMetric;
  balanceScore: ScoredMetric;
  timingScore: ScoredMetric;
}

export interface AdvancedFingerprintMetrics {
  prosodyArc: ProsodyArc;
  languageTexture: LanguageTexture;
  narrativeArc: NarrativeArc;
  visualEditAlignment: VisualEditAlignment;
  modalityBalance: ModalityBalance;
  cognitiveLoad: CognitiveLoad;
  secondOrder: SecondOrderSummary;
}

import type { DerivedScores } from "../analysis/types/derivedScores";

export type VideoFingerprintVersion = "1.4.0";
export type LegacyVideoFingerprintVersion = "1.1.0" | "1.2.0" | "1.3.0";

interface VideoFingerprintBase {
  createdAt: string;
  metaAxes: MetaAxes;
  perDomain: FingerprintPerDomain;
  overallArchetype?: string;
  supporting?: {
    transcriptSegments?: TranscriptSegment[];
    sceneSegments?: SceneSegment[];
    beats?: BeatSegment[];
    axisDetails?: Record<string, AxisDetail>;
    perChapterMetrics?: Array<Record<string, unknown>>;
    advancedSegments?: Array<Record<string, unknown>>;
  };
  performanceProfile?: PerformanceProfile;
  hasPerformanceData?: boolean;
  derivedScores?: DerivedScores;
}

export interface VideoFingerprintJson extends VideoFingerprintBase, AdvancedFingerprintMetrics {
  version: VideoFingerprintVersion;
}

export type LegacyVideoFingerprintJson = VideoFingerprintBase & {
  version: LegacyVideoFingerprintVersion;
};

export interface VideoFingerprint {
  id: string;
  videoAnalysisId: string;
  fingerprint: VideoFingerprintJson;
  createdAt?: string;
}
