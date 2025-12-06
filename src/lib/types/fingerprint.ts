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

export type DomainScore = AxisScore;

export interface DomainProfile {
  primaryArchetype: string;
  secondaryArchetype?: string;
  summaryText: string;
  scores: DomainScore[];
  highlights?: string[];
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

export interface BeatSegment {
  startSeconds: number;
  endSeconds: number;
  label: string;
  devices: string[];
}

export interface VideoFingerprintJson {
  version: "1.1.0";
  createdAt: string;
  metaAxes: MetaAxes;
  perDomain: FingerprintPerDomain;
  overallArchetype?: string;
  supporting?: {
    transcriptSegments?: TranscriptSegment[];
    sceneSegments?: SceneSegment[];
    beats?: BeatSegment[];
  };
}

export interface VideoFingerprint {
  id: string;
  videoAnalysisId: string;
  fingerprint: VideoFingerprintJson;
  createdAt?: string;
}
