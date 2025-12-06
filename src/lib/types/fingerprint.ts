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
  createdAt?: string;
  updatedAt?: string;
}

export interface AxisScore {
  key: string;
  label: string;
  value: number;
}

export interface DomainProfile {
  archetype: string;
  summary: string;
  description: string;
  axes: AxisScore[];
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

export interface VideoFingerprintJson {
  version: "1.0.0";
  createdAt: string;
  metaAxes: MetaAxes;
  perDomain: FingerprintPerDomain;
  overallArchetype?: string;
}

export interface VideoFingerprint {
  id: string;
  videoAnalysisId: string;
  fingerprint: VideoFingerprintJson;
  createdAt?: string;
}
