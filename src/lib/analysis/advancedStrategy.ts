import type { AppConfig } from "../config";
import type { AdvancedPassConfig } from "./advancedPass";
import type { AdvancedPlannerConfig } from "./advancedPlanner";

export type AdvancedStrategy = "full" | "selective" | "minimal";

const SHORT_VIDEO_MAX_SECONDS = 180;
const MEDIUM_VIDEO_MAX_SECONDS = 600;

export const resolveAdvancedStrategy = (durationSeconds?: number): AdvancedStrategy => {
  if (!durationSeconds || durationSeconds <= 0) return "selective";
  if (durationSeconds < SHORT_VIDEO_MAX_SECONDS) return "full";
  if (durationSeconds <= MEDIUM_VIDEO_MAX_SECONDS) return "selective";
  return "minimal";
};

const resolveMaxSegments = (config: AppConfig, strategy: AdvancedStrategy) => {
  if (strategy === "minimal") return Math.min(config.advancedMaxSegments, 2);
  return config.advancedMaxSegments;
};

export const buildAdvancedPlannerConfig = (
  config: AppConfig,
  strategy: AdvancedStrategy,
): AdvancedPlannerConfig => {
  const maxSegments = resolveMaxSegments(config, strategy);
  const segmentMaxSeconds = config.advancedSegmentMaxSeconds;
  const hookMaxSeconds = Math.min(90, segmentMaxSeconds);

  if (strategy === "full") {
    return {
      maxSegments,
      segmentMaxSeconds,
      hookMaxSeconds,
      minObservedPct: 0,
      cutRateThreshold: 0,
      structureClarityThreshold: 100,
    };
  }

  if (strategy === "minimal") {
    return {
      maxSegments,
      segmentMaxSeconds,
      hookMaxSeconds,
      cutRateThreshold: 101,
      structureClarityThreshold: -1,
    };
  }

  return { maxSegments, segmentMaxSeconds, hookMaxSeconds };
};

export const buildAdvancedPassConfig = (config: AppConfig, strategy: AdvancedStrategy): AdvancedPassConfig => ({
  maxSegments: resolveMaxSegments(config, strategy),
  maxCostUsd: config.advancedMaxPassCostUsd,
  maxDurationMs: config.advancedMaxPassDurationMs,
});
