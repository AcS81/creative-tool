import type { VideoFingerprintJson } from "../types";

export interface AnalyzeVideoInput {
  videoId: string;
  title?: string;
  durationSeconds?: number;
  creatorDisplayName?: string;
}

export interface AnalyzeVideoResult {
  fingerprint: VideoFingerprintJson;
  overallArchetype: string;
  diagnostics?: {
    source: "mock";
    hashSeed: number;
  };
}
