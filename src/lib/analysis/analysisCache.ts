import crypto from "node:crypto";
import type { AppConfig } from "../config";
import type { VideoFingerprintJson } from "../types";
import { FINGERPRINT_SCHEMA_VERSION } from "../schemas/fingerprintContract";
import { FINGERPRINT_SCHEMA_HASH } from "../schemas/fingerprintSchemaHash";

type AnalysisConfigPayload = {
  signatureVersion: 1;
  fingerprintSchemaVersion: typeof FINGERPRINT_SCHEMA_VERSION;
  fingerprintSchemaHash: string;
  analysisMode: AppConfig["analysisMode"];
  analysisVersion: AppConfig["analysisVersion"];
  multimodalPassMode: AppConfig["multimodalPassMode"] | null;
  advancedMetricsEnabled: boolean;
  advancedMaxSegments: number;
  advancedSegmentMaxSeconds: number;
  advancedMaxTimelinePoints: number;
  advancedMaxPassCostUsd: number;
  advancedMaxPassDurationMs: number;
  structurePassEnabled: boolean;
  structurePassTimeoutMs: number;
  geminiResponseSchemaEnabled: boolean;
  advancedSchemaStrategy: "inherit" | "strict" | "optional";
  advancedResponseFormat: "full" | "compact";
  models: {
    core: string | null;
    advancedAudio: string | null;
    advancedVisual: string | null;
    salvage: string | null;
  };
};

export type AnalysisConfigSignature = {
  hash: string;
  payload: AnalysisConfigPayload;
  serialized: string;
};

export const buildAnalysisConfigSignature = (config: AppConfig): AnalysisConfigSignature => {
  const payload: AnalysisConfigPayload = {
    signatureVersion: 1,
    fingerprintSchemaVersion: FINGERPRINT_SCHEMA_VERSION,
    fingerprintSchemaHash: FINGERPRINT_SCHEMA_HASH,
    analysisMode: config.analysisMode,
    analysisVersion: config.analysisVersion,
    multimodalPassMode: config.multimodalPassMode ?? null,
    advancedMetricsEnabled: config.advancedMetricsEnabled,
    advancedMaxSegments: config.advancedMaxSegments,
    advancedSegmentMaxSeconds: config.advancedSegmentMaxSeconds,
    advancedMaxTimelinePoints: config.advancedMaxTimelinePoints,
    advancedMaxPassCostUsd: config.advancedMaxPassCostUsd,
    advancedMaxPassDurationMs: config.advancedMaxPassDurationMs,
    structurePassEnabled: config.structurePassEnabled,
    structurePassTimeoutMs: config.structurePassTimeoutMs,
    geminiResponseSchemaEnabled: config.geminiResponseSchemaEnabled ?? false,
    advancedSchemaStrategy: config.advancedSchemaStrategy ?? "inherit",
    advancedResponseFormat: config.advancedResponseFormat ?? "full",
    models: {
      core: config.geminiMultimodalCoreModel ?? null,
      advancedAudio: config.geminiMultimodalAdvancedAudioModel ?? null,
      advancedVisual: config.geminiMultimodalAdvancedVisualModel ?? null,
      salvage: config.geminiMultimodalSalvageModel ?? null,
    },
  };
  const serialized = JSON.stringify(payload);
  const hash = crypto.createHash("sha256").update(serialized).digest("hex");
  return { hash, payload, serialized };
};

export const isCacheableFingerprint = (fingerprint: VideoFingerprintJson) =>
  fingerprint.hasPerformanceData !== true;
