import type { VideoFingerprintJson } from "../types";

export interface AnalyzeVideoInput {
  videoId: string;
  title?: string;
  durationSeconds?: number;
  creatorDisplayName?: string;
  channelId?: string;
}

export interface AnalyzeVideoResult {
  fingerprint: VideoFingerprintJson;
  overallArchetype: string;
  diagnostics?: {
    source: "mock" | "gemini";
    hashSeed?: number;
    performanceAttached?: boolean;
  };
}
