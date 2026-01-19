import type { PassResult } from "./types";
import type { CoreMetrics } from "./types/coreMetrics";
import type { DerivedScores } from "./types/derivedScores";
import type { SegmentAdvancedMetrics } from "./types/advancedMetrics";
import type { AdvancedSchemaStrategy, AdvancedResponseFormat } from "../config";
import { getTier1Metrics, getTier2Metrics, getDerivedMetrics } from "./metricRegistry";

export interface PipelineDiagnostics {
  // Pass results
  structurePass?: PassResult;
  corePass?: PassResult;
  advancedPasses: PassResult[];
  derivedComputation?: PassResult;

  // Coverage percentages
  overallCoverage: {
    tier1Observed: number; // % of Tier 1 metrics observed
    tier2Observed: number; // % of Tier 2 metrics observed (when requested)
    tier3Computed: number; // % of Tier 3 metrics computable
  };

  // Cost aggregation
  totalCostUsd: number;
  totalDurationMs: number;
  totalTokensUsed: number;
  costBreakdown: {
    structure?: number;
    core?: number;
    advanced?: number;
    derived?: number; // Always 0 (local computation)
  };

  // Tier 2 configuration tracking
  tier2Config?: {
    advancedSchemaStrategy: AdvancedSchemaStrategy;
    advancedResponseFormat: AdvancedResponseFormat;
    schemaRejectionCount: number; // Number of schema rejections before fallback
    timelineInterpolated: boolean; // True if compact mode was used
  };
}

export interface BuildPipelineDiagnosticsInput {
  structurePass?: PassResult;
  corePass?: PassResult;
  advancedPasses?: PassResult[];
  derivedComputation?: PassResult;
  coreMetrics?: CoreMetrics;
  advancedMetrics?: SegmentAdvancedMetrics[];
  derivedScores?: DerivedScores;
  tier2Config?: {
    advancedSchemaStrategy?: AdvancedSchemaStrategy;
    advancedResponseFormat?: AdvancedResponseFormat;
    schemaRejectionCount?: number;
    timelineInterpolated?: boolean;
  };
}

/**
 * Computes Tier 1 observation coverage from CoreMetrics
 */
const computeTier1Coverage = (coreMetrics?: CoreMetrics): number => {
  if (!coreMetrics) return 0;

  const tier1Metrics = getTier1Metrics();
  let observedCount = 0;
  let totalCount = 0;

  // Count observed metrics from CoreMetrics structure
  const metrics = [
    // Voice (7 metrics)
    coreMetrics.voice.speakingRate,
    coreMetrics.voice.fillerRate,
    coreMetrics.voice.pauseUsage,
    coreMetrics.voice.loudnessRange,
    coreMetrics.voice.pitchVariation,
    coreMetrics.voice.clarity,
    coreMetrics.voice.warmth,
    // Language (6 metrics)
    coreMetrics.language.concreteness,
    coreMetrics.language.metaphorDensity,
    coreMetrics.language.references,
    coreMetrics.language.humor,
    coreMetrics.language.teachingVsRiffing,
    coreMetrics.language.storyPresence,
    // Narrative (4 metrics)
    coreMetrics.narrative.structureClarity,
    coreMetrics.narrative.hookPresence,
    coreMetrics.narrative.transitionQuality,
    coreMetrics.narrative.payoffDelivery,
    // Visual (4 metrics)
    coreMetrics.visual.cutRate,
    coreMetrics.visual.environmentStability,
    coreMetrics.visual.movement,
    coreMetrics.visual.expression,
    // Sound (4 metrics)
    coreMetrics.sound.musicCoverage,
    coreMetrics.sound.musicBalance,
    coreMetrics.sound.sfxDensity,
    coreMetrics.sound.silenceUsage,
  ];

  totalCount = metrics.length;
  observedCount = metrics.filter((m) => m.observed).length;

  return totalCount > 0 ? (observedCount / totalCount) * 100 : 0;
};

/**
 * Computes Tier 2 observation coverage from AdvancedMetrics
 */
const computeTier2Coverage = (advancedMetrics?: SegmentAdvancedMetrics[]): number => {
  if (!advancedMetrics || advancedMetrics.length === 0) return 0;

  const tier2Metrics = getTier2Metrics();
  const totalTier2Metrics = tier2Metrics.length;

  if (totalTier2Metrics === 0) return 0;

  // Track which Tier 2 metrics have been observed across all segments
  // Use a Set to avoid double-counting the same metric across segments
  const observedMetricIds = new Set<string>();

  for (const segment of advancedMetrics) {
    // Check prosodyArc metrics
    if (segment.prosodyArc) {
      if (segment.prosodyArc.paceMeanWpm?.observed) observedMetricIds.add("paceMeanWpm");
      if (segment.prosodyArc.paceVariabilityPct?.observed) observedMetricIds.add("paceVariabilityPct");
      if (segment.prosodyArc.withinSegmentPaceChangePct?.observed) observedMetricIds.add("withinSegmentPaceChangePct");
      if (segment.prosodyArc.emphasisAlignmentScore?.observed) observedMetricIds.add("emphasisAlignmentScore");
      if (segment.prosodyArc.energyDriftDbPerMin?.observed) observedMetricIds.add("energyDriftDbPerMin");
    }

    // Check languageTexture metrics
    if (segment.languageTexture) {
      if (segment.languageTexture.analogyExampleDefinitionRatio?.observed) observedMetricIds.add("analogyExampleDefinitionRatio");
      if (segment.languageTexture.sentenceCompressionRatio?.observed) observedMetricIds.add("sentenceCompressionRatio");
      if (segment.languageTexture.humorTimingScore?.observed) observedMetricIds.add("humorTimingScore");
      if (segment.languageTexture.referenceDensityPerMin?.observed) observedMetricIds.add("referenceDensityPerMin");
      if (segment.languageTexture.questionRate?.observed) observedMetricIds.add("questionRate");
      if (segment.languageTexture.audienceAddressFrequency?.observed) observedMetricIds.add("audienceAddressFrequency");
    }

    // Check narrativeArc metrics
    if (segment.narrativeArc) {
      if (segment.narrativeArc.timeToHookSeconds?.observed) observedMetricIds.add("timeToHookSeconds");
      if (segment.narrativeArc.hookStrengthScore?.observed) observedMetricIds.add("hookStrengthScore");
      if (segment.narrativeArc.segmentCohesionDrift?.observed) observedMetricIds.add("segmentCohesionDrift");
      if (segment.narrativeArc.openLoopsUnresolvedRatio?.observed) observedMetricIds.add("openLoopsUnresolvedRatio");
      if (segment.narrativeArc.endingResolutionScore?.observed) observedMetricIds.add("endingResolutionScore");
    }

    // Check visualEditAlignment metrics
    if (segment.visualEditAlignment) {
      if (segment.visualEditAlignment.visualEntropy?.observed) observedMetricIds.add("visualEntropy");
      if (segment.visualEditAlignment.cutRateRefinement?.observed) observedMetricIds.add("cutRateRefinement");
      if (segment.visualEditAlignment.silenceForEmphasisFidelity?.observed) observedMetricIds.add("silenceForEmphasisFidelity");
      if (segment.visualEditAlignment.audioVisualEmphasisAlignment?.observed) observedMetricIds.add("audioVisualEmphasisAlignment");
      if (segment.visualEditAlignment.beatsVsEditsAlignment?.observed) observedMetricIds.add("beatsVsEditsAlignment");
      if (segment.visualEditAlignment.prosodyVsSemanticImportanceAlignment?.observed) observedMetricIds.add("prosodyVsSemanticImportanceAlignment");
    }
  }

  // Calculate percentage of unique Tier 2 metrics observed
  return totalTier2Metrics > 0 ? (observedMetricIds.size / totalTier2Metrics) * 100 : 0;
};

/**
 * Computes Tier 3 computability coverage from DerivedScores
 */
const computeTier3Coverage = (derivedScores?: DerivedScores): number => {
  if (!derivedScores) return 0;

  const tier3Metrics = getDerivedMetrics();
  const totalTier3Metrics = tier3Metrics.length;

  if (totalTier3Metrics === 0) return 0;

  let computedCount = 0;

  // Count all derived scores that are observed
  const scores = [
    // Meta axes (5)
    derivedScores.metaAxes.voiceIntensity,
    derivedScores.metaAxes.conceptualDepth,
    derivedScores.metaAxes.narrativeStructureStrength,
    derivedScores.metaAxes.visualDynamism,
    derivedScores.metaAxes.productionPolish,
    // Alignment (4)
    derivedScores.alignment.audioVisualAlignment,
    derivedScores.alignment.beatsEditsAlignment,
    derivedScores.alignment.prosodySemanticAlignment,
    derivedScores.alignment.overallAlignment,
    // Balance (4)
    derivedScores.balance.redundancyScore,
    derivedScores.balance.complementarityScore,
    derivedScores.balance.overRelianceScore,
    derivedScores.balance.overallBalance,
    // Cognitive load (4)
    derivedScores.cognitiveLoad.averageLoad,
    derivedScores.cognitiveLoad.peakLoad,
    derivedScores.cognitiveLoad.loadVariance,
    derivedScores.cognitiveLoad.overloadMoments,
    // Second-order (5)
    derivedScores.secondOrder.alignmentScore,
    derivedScores.secondOrder.driftScore,
    derivedScores.secondOrder.decayScore,
    derivedScores.secondOrder.balanceScore,
    derivedScores.secondOrder.timingScore,
  ];

  computedCount = scores.filter((s) => s.observed).length;

  return totalTier3Metrics > 0 ? (computedCount / totalTier3Metrics) * 100 : 0;
};

/**
 * Builds complete pipeline diagnostics from all pass results and metrics
 */
export function buildPipelineDiagnostics(
  input: BuildPipelineDiagnosticsInput,
): PipelineDiagnostics {
  const {
    structurePass,
    corePass,
    advancedPasses = [],
    derivedComputation,
    coreMetrics,
    advancedMetrics,
    derivedScores,
    tier2Config,
  } = input;

  // Compute coverage percentages
  const tier1Observed = computeTier1Coverage(coreMetrics);
  const tier2Observed = computeTier2Coverage(advancedMetrics);
  const tier3Computed = computeTier3Coverage(derivedScores);

  // Aggregate costs
  const structureCost = structurePass?.costUsd ?? 0;
  const coreCost = corePass?.costUsd ?? 0;
  const advancedCost = advancedPasses.reduce((sum, pass) => sum + (pass.costUsd ?? 0), 0);
  const derivedCost = 0; // Always 0 (local computation)
  const totalCostUsd = structureCost + coreCost + advancedCost + derivedCost;

  // Aggregate durations
  const structureDuration = structurePass?.durationMs ?? 0;
  const coreDuration = corePass?.durationMs ?? 0;
  const advancedDuration = advancedPasses.reduce((sum, pass) => sum + (pass.durationMs ?? 0), 0);
  const derivedDuration = derivedComputation?.durationMs ?? 0;
  const totalDurationMs = structureDuration + coreDuration + advancedDuration + derivedDuration;

  // Aggregate tokens
  const structureTokens = structurePass?.tokensUsed ?? 0;
  const coreTokens = corePass?.tokensUsed ?? 0;
  const advancedTokens = advancedPasses.reduce((sum, pass) => sum + (pass.tokensUsed ?? 0), 0);
  const derivedTokens = derivedComputation?.tokensUsed ?? 0;
  const totalTokensUsed = structureTokens + coreTokens + advancedTokens + derivedTokens;

  return {
    structurePass,
    corePass,
    advancedPasses,
    derivedComputation,
    overallCoverage: {
      tier1Observed,
      tier2Observed,
      tier3Computed,
    },
    totalCostUsd,
    totalDurationMs,
    totalTokensUsed,
    costBreakdown: {
      structure: structureCost > 0 ? structureCost : undefined,
      core: coreCost > 0 ? coreCost : undefined,
      advanced: advancedCost > 0 ? advancedCost : undefined,
      derived: derivedCost, // Always 0, but included for completeness
    },
    tier2Config: tier2Config
      ? {
          advancedSchemaStrategy: tier2Config.advancedSchemaStrategy ?? "inherit",
          advancedResponseFormat: tier2Config.advancedResponseFormat ?? "full",
          schemaRejectionCount: tier2Config.schemaRejectionCount ?? 0,
          timelineInterpolated: tier2Config.timelineInterpolated ?? false,
        }
      : undefined,
  };
}
