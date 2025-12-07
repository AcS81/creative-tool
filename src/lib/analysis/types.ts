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
    performanceErrorType?: string;
    performanceErrorMessage?: string;
    analysisVersion?: "v1_text" | "v2_multimodal";
    usedFallback?: boolean;
    unobservedCounts?: Record<string, number>;
  };
}

// Multimodal analysis v2 response contracts.
export * from "./types/multimodal";
