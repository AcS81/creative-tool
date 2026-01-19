import type { VideoFingerprintJson } from "../types";
import type { GeminiRequestMetrics, GeminiUsage } from "../gemini/client";
import type { SegmentAdvancedMetrics } from "./types/advancedMetrics";
import type { VideoSkeleton } from "./types/skeleton";
import type { AnalysisError } from "./errorHandling";

export interface AnalyzeVideoInput {
  videoId: string;
  title?: string;
  durationSeconds?: number;
  creatorDisplayName?: string;
  channelId?: string;
}

export type FingerprintLoadError = {
  code: "invalid_json" | "invalid_schema";
  message: string;
  details?: string;
  version?: string;
  schemaHash?: string;
};

export type PassResult = {
  success: boolean;
  durationMs: number;
  tokensUsed: number;
  costUsd: number;
  retryCount: number;
  errorMessage?: string;
};

export interface AnalyzeVideoResult {
  fingerprint: VideoFingerprintJson;
  skeleton: VideoSkeleton;
  advancedMetrics?: SegmentAdvancedMetrics[];
  overallArchetype: string;
  diagnostics?: {
    source: "mock" | "gemini-v1-text" | "gemini-v2-multimodal" | "gemini-v2-tiered";
    structurePass?: PassResult;
    corePass?: PassResult;
    advancedPass?: PassResult;
    advancedPasses?: PassResult[];
    derivedComputation?: PassResult;
    overallCoverage?: {
      tier1Observed: number;
      tier2Observed: number;
      tier3Computed: number;
    };
    totalCostUsd?: number;
    totalDurationMs?: number;
    tier2Config?: {
      advancedSchemaStrategy: "inherit" | "strict" | "optional";
      advancedResponseFormat: "full" | "compact";
      schemaRejectionCount: number;
      timelineInterpolated: boolean;
    };
    hashSeed?: number;
    performanceAttached?: boolean;
    performanceErrorType?: string;
    performanceErrorMessage?: string;
    analysisVersion?: "v1" | "v2";
    unobservedCounts?: Record<string, number>;
    analysisPath?: "gemini-v2-multimodal" | "gemini-v2-tiered" | "gemini-v1-text" | "mock";
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
    fingerprintLoadError?: FingerprintLoadError;
    errors?: AnalysisError[];
    warnings?: string[];
    fallbacksUsed?: string[];
    overallSuccess?: boolean;
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
export * from "./types";
