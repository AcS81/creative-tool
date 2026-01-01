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
    source: "mock" | "gemini-v1-text" | "gemini-v2-multimodal" | "gemini-v2-transcript";
    hashSeed?: number;
    performanceAttached?: boolean;
    performanceErrorType?: string;
    performanceErrorMessage?: string;
    analysisVersion?: "v1" | "v2";
    multimodalFallbackUsed?: boolean;
    transcriptFallbackUsed?: boolean;
    lowerConfidence?: boolean;
    lowerConfidenceReason?: string;
    unobservedCounts?: Record<string, number>;
    analysisPath?: "gemini-v2-multimodal" | "gemini-v1-text" | "mock" | "gemini-v2-transcript";
    analysisErrorMessage?: string;
    advancedMetricsDefaulted?: boolean;
    advancedMetricsObserved?: boolean;
    advancedMetricsDefaultReason?: string;
    advancedMetricsObservedBySection?: {
      prosodyArc?: boolean;
      languageTexture?: boolean;
      narrativeArc?: boolean;
      visualEditAlignment?: boolean;
      modalityBalance?: boolean;
      cognitiveLoad?: boolean;
      secondOrder?: boolean;
    };
    coverage?: {
      core?: Record<string, { observed: number; total: number; missing: string[]; observedPct: number }>;
      advanced?: Record<string, { observed: number; total: number; missing: string[]; observedPct: number; available?: boolean }>;
      supplemental?: Record<string, { observed: number; total: number; missing: string[]; observedPct: number; available?: boolean }>;
    };
    salvage?: {
      attempted?: boolean;
      sections?: string[];
      reason?: string;
    };
    ingestionPreflight?: IngestionPreflight;
  };
}

export type IngestionPreflight = {
  ok: boolean;
  failureMessage?: string;
  validUrl: boolean;
  fileData: {
    eligible: boolean;
    status: "unknown" | "allowed" | "blocked";
    reason?: string;
  };
  fallback: {
    checked: boolean;
    viable?: boolean;
    status?: number;
    contentType?: string;
    looksLikeHtml?: boolean;
    reason?: string;
  };
};

// Multimodal analysis v2 response contracts.
export * from "./types/multimodal";
