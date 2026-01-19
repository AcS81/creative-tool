import type { AdvancedFingerprintMetrics, ScoredMetric, SecondOrderSummary } from "../../types";

/**
 * @deprecated This function is maintained for backward compatibility with the fingerprint schema.
 * New code should use `computeSecondOrderScores` from `derivedScores.ts` which works with
 * the new tiered architecture and provides better fallback handling.
 * 
 * This function computes second-order scores from advanced metrics only (no core metrics or derived scores).
 * It returns ScoredMetric format for compatibility with AdvancedFingerprintMetrics.secondOrder.
 */
type AdvancedWithoutSecondOrder = Omit<AdvancedFingerprintMetrics, "secondOrder">;

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const isMetricObserved = (metric?: ScoredMetric) => {
  if (!metric) return false;
  if (metric.observed === true) return true;
  const value = typeof metric.value === "string" ? metric.value.trim().toLowerCase() : "";
  const hasValue = value !== "" && value !== "unobserved";
  const hasScore = typeof metric.score === "number" && metric.score > 0;
  return hasValue || hasScore;
};

const weightedAverage = (...entries: Array<[number, number]>) => {
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0) || 1;
  return entries.reduce((sum, [v, w]) => sum + v * w, 0) / totalWeight;
};

const unobservedMetric = (): ScoredMetric => ({
  score: 0,
  value: "unobserved",
  observed: false,
});

const derivedMetric = (score: number): ScoredMetric => {
  const rounded = Math.round(clamp(score));
  return {
    score: rounded,
    value: String(rounded),
    observed: true,
  };
};

const deriveSecondOrderMetric = (
  entries: Array<[ScoredMetric, number]>,
): ScoredMetric => {
  if (!entries.every(([metric]) => isMetricObserved(metric))) {
    return unobservedMetric();
  }
  const pairs = entries.map(([metric, weight]) => [metric.score, weight] as [number, number]);
  const score = weightedAverage(...pairs);
  return derivedMetric(score);
};

/**
 * @deprecated Use `computeSecondOrderScores` from `derivedScores.ts` instead.
 * This function is kept for backward compatibility with legacy fingerprint schema.
 * 
 * Computes second-order scores from advanced metrics only.
 * For new tiered analysis, use the version in derivedScores.ts which:
 * - Works with core metrics and derived scores
 * - Provides better fallback handling
 * - Returns DerivedScore format (stored in fingerprint.derivedScores)
 */
export const computeSecondOrderScores = (metrics: AdvancedWithoutSecondOrder): SecondOrderSummary => {
  const alignmentScore = deriveSecondOrderMetric([
    [metrics.prosodyArc.emphasisAlignmentScore, 0.3],
    [metrics.visualEditAlignment.audioVisualEmphasisAlignment, 0.25],
    [metrics.visualEditAlignment.beatsVsEditsAlignment, 0.25],
    [metrics.visualEditAlignment.prosodyVsSemanticImportanceAlignment, 0.2],
  ]);
  const driftScore = deriveSecondOrderMetric([
    [metrics.prosodyArc.energyDriftDbPerMin, 0.35],
    [metrics.prosodyArc.paceVariabilityPct, 0.25],
    [metrics.narrativeArc.segmentCohesionDrift, 0.4],
  ]);
  const decayScore = deriveSecondOrderMetric([
    [metrics.prosodyArc.withinSegmentPaceChangePct, 0.4],
    [metrics.prosodyArc.energyDriftDbPerMin, 0.3],
    [metrics.cognitiveLoad.loadPerSecond, 0.3],
  ]);
  const balanceScore = (() => {
    const redundancy = metrics.modalityBalance.redundancyVsComplementarity;
    const overReliance = metrics.modalityBalance.modalityOverReliance;
    if (!isMetricObserved(redundancy) || !isMetricObserved(overReliance)) {
      return unobservedMetric();
    }
    const score = weightedAverage(
      [redundancy.score, 0.6],
      [clamp(100 - overReliance.score), 0.4],
    );
    return derivedMetric(score);
  })();
  const timingScore = (() => {
    const timeToHook = metrics.narrativeArc.timeToHookSeconds;
    const hookStrength = metrics.narrativeArc.hookStrengthScore;
    const beatsVsEdits = metrics.visualEditAlignment.beatsVsEditsAlignment;
    const silence = metrics.visualEditAlignment.silenceForEmphasisFidelity;
    if (
      !isMetricObserved(timeToHook) ||
      !isMetricObserved(hookStrength) ||
      !isMetricObserved(beatsVsEdits) ||
      !isMetricObserved(silence)
    ) {
      return unobservedMetric();
    }
    const score = weightedAverage(
      [clamp(100 - timeToHook.score / 2), 0.25],
      [hookStrength.score, 0.25],
      [beatsVsEdits.score, 0.25],
      [silence.score, 0.25],
    );
    return derivedMetric(score);
  })();

  return {
    alignmentScore,
    driftScore,
    decayScore,
    balanceScore,
    timingScore,
  };
};
