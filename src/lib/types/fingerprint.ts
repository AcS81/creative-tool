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

export type VideoFingerprintVersion = "1.2.0";
export type LegacyVideoFingerprintVersion = "1.1.0";

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
  };
  performanceProfile?: PerformanceProfile;
  hasPerformanceData?: boolean;
}

export interface VideoFingerprintJson extends VideoFingerprintBase {
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
