import type { VideoFingerprintJson } from "../types";
import type { GeminiRequestMetrics, GeminiUsage } from "../gemini/client";

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
    source: "mock" | "gemini-v1-text" | "gemini-v2-multimodal";
    hashSeed?: number;
    performanceAttached?: boolean;
    performanceErrorType?: string;
    performanceErrorMessage?: string;
    analysisVersion?: "v1" | "v2";
    unobservedCounts?: Record<string, number>;
    analysisPath?: "gemini-v2-multimodal" | "gemini-v1-text" | "mock";
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
    advancedParse?: {
      audioText?: {
        strictError?: string;
        lenientError?: string;
        keys?: string[];
        preview?: string;
      };
      visualCross?: {
        strictError?: string;
        lenientError?: string;
        keys?: string[];
        preview?: string;
      };
      salvage?: Record<
        string,
        {
          strictError?: string;
          lenientError?: string;
          keys?: string[];
          preview?: string;
        }
      >;
    };
    passMetrics?: {
      core?: GeminiRequestMetrics;
      coreRetry?: GeminiRequestMetrics;
      advancedAudioText?: GeminiRequestMetrics;
      advancedVisualCross?: GeminiRequestMetrics;
      salvage?: Record<string, GeminiRequestMetrics>;
      totals?: {
        durationMs: number;
        attempts: number;
        retries: number;
        usage?: GeminiUsage;
        estimatedCostUsd?: number;
      };
    };
    ingestionPreflight?: IngestionPreflight;
  };
}

export type IngestionPreflight = {
  ok: boolean;
  failureMessage?: string;
  validUrl: boolean;
  urlIngestion: {
    eligible: boolean;
  };
};

// Multimodal analysis v2 response contracts.
export * from "./types/multimodal";
