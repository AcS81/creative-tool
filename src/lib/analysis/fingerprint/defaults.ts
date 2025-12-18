import type { AdvancedFingerprintMetrics, ScoredMetric } from "../../types";

const defaultMetric = (): ScoredMetric => ({
  score: 0,
  value: "unobserved",
  observed: false,
  timeline: [],
  spans: [],
  segments: [],
  items: [],
  proportions: undefined,
  counts: undefined,
  trend: undefined,
});

export const buildDefaultAdvancedMetrics = (): AdvancedFingerprintMetrics => ({
  prosodyArc: {
    paceMeanWpm: defaultMetric(),
    paceVariabilityPct: defaultMetric(),
    withinSegmentPaceChangePct: defaultMetric(),
    emphasisAlignmentScore: defaultMetric(),
    energyDriftDbPerMin: defaultMetric(),
  },
  languageTexture: {
    analogyExampleDefinitionRatio: defaultMetric(),
    sentenceCompressionRatio: defaultMetric(),
    humorTimingScore: defaultMetric(),
    referenceDensityPerMin: defaultMetric(),
    questionRate: defaultMetric(),
  },
  narrativeArc: {
    timeToHookSeconds: defaultMetric(),
    hookStrengthScore: defaultMetric(),
    segmentCohesionDrift: defaultMetric(),
    openLoopsUnresolvedRatio: defaultMetric(),
    endingResolutionScore: defaultMetric(),
  },
  visualEditAlignment: {
    visualEntropy: defaultMetric(),
    cutRateRefinement: defaultMetric(),
    silenceForEmphasisFidelity: defaultMetric(),
    audioVisualEmphasisAlignment: defaultMetric(),
    beatsVsEditsAlignment: defaultMetric(),
    prosodyVsSemanticImportanceAlignment: defaultMetric(),
  },
  modalityBalance: {
    redundancyVsComplementarity: defaultMetric(),
    modalityOverReliance: defaultMetric(),
  },
  cognitiveLoad: {
    loadPerSecond: defaultMetric(),
    loadHighlights: defaultMetric(),
  },
  secondOrder: {
    alignmentScore: defaultMetric(),
    driftScore: defaultMetric(),
    decayScore: defaultMetric(),
    balanceScore: defaultMetric(),
    timingScore: defaultMetric(),
  },
});

export const withDefaultAdvancedMetrics = (
  overrides?: Partial<AdvancedFingerprintMetrics>,
): AdvancedFingerprintMetrics => {
  const base = buildDefaultAdvancedMetrics();
  return {
    prosodyArc: overrides?.prosodyArc ?? base.prosodyArc,
    languageTexture: overrides?.languageTexture ?? base.languageTexture,
    narrativeArc: overrides?.narrativeArc ?? base.narrativeArc,
    visualEditAlignment: overrides?.visualEditAlignment ?? base.visualEditAlignment,
    modalityBalance: overrides?.modalityBalance ?? base.modalityBalance,
    cognitiveLoad: overrides?.cognitiveLoad ?? base.cognitiveLoad,
    secondOrder: overrides?.secondOrder ?? base.secondOrder,
  };
};
