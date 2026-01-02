import crypto from "node:crypto";
import type { AppConfig } from "../config";
import type { VideoFingerprintJson } from "../types";

type AnalysisConfigPayload = {
  signatureVersion: 1;
  analysisMode: AppConfig["analysisMode"];
  analysisVersion: AppConfig["analysisVersion"];
  multimodalPassMode: AppConfig["multimodalPassMode"] | null;
  advancedMetricsEnabled: boolean;
  geminiResponseSchemaEnabled: boolean;
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
    analysisMode: config.analysisMode,
    analysisVersion: config.analysisVersion,
    multimodalPassMode: config.multimodalPassMode ?? null,
    advancedMetricsEnabled: config.advancedMetricsEnabled,
    geminiResponseSchemaEnabled: config.geminiResponseSchemaEnabled ?? false,
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
