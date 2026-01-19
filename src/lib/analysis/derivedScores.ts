import type { AdvancedFingerprintMetrics, ScoredMetric, TimelinePoint } from "../types";
import type { CoreMetrics, SummaryMetric } from "./types/coreMetrics";
import type { DerivedScore, DerivedScores } from "./types/derivedScores";
import type { VideoSkeleton } from "./types/skeleton";

type WeightedMetricInput = {
  metric: SummaryMetric;
  weight?: number;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const unobservedDerivedScore = (): DerivedScore => ({ value: 0, observed: false });

const computeWeightedScore = (inputs: WeightedMetricInput[]): DerivedScore => {
  if (inputs.length === 0) {
    return { value: 0, observed: false };
  }

  const observedInputs = inputs.filter(({ metric }) => metric.observed);
  if (observedInputs.length === 0) {
    return { value: 0, observed: false };
  }

  const totalWeight = observedInputs.reduce((sum, { weight }) => sum + (weight ?? 1), 0);
  const weightedValue =
    totalWeight > 0
      ? observedInputs.reduce((sum, { metric, weight }) => sum + metric.score * (weight ?? 1), 0) /
        totalWeight
      : 0;

  return {
    value: clamp(weightedValue),
    observed: observedInputs.length / inputs.length > 0.5,
  };
};

const computeWeightedScoredMetric = (
  inputs: Array<{ metric?: ScoredMetric; weight?: number }>,
): DerivedScore => {
  if (inputs.length === 0) {
    return { value: 0, observed: false };
  }

  const observedInputs = inputs.filter(({ metric }) => isObservedMetric(metric));
  if (observedInputs.length === 0) {
    return { value: 0, observed: false };
  }

  const totalWeight = observedInputs.reduce((sum, { weight }) => sum + (weight ?? 1), 0);
  const weightedValue =
    totalWeight > 0
      ? observedInputs.reduce((sum, { metric, weight }) => sum + (metric?.score ?? 0) * (weight ?? 1), 0) /
        totalWeight
      : 0;

  return {
    value: clamp(weightedValue),
    observed: observedInputs.length / inputs.length > 0.5,
  };
};

const invertSummaryMetric = (metric: SummaryMetric): SummaryMetric => ({
  score: clamp(100 - metric.score),
  value: metric.value,
  observed: metric.observed,
});

const derivedScoreToSummaryMetric = (score: DerivedScore): SummaryMetric => ({
  score: score.value,
  value: String(score.value),
  observed: score.observed,
});

const CONCEPTUAL_DEPTH_WEIGHTS = {
  concreteness: 0.4,
  metaphorDensity: 0.3,
  references: 0.3,
};

export const computeMetaAxes = (coreMetrics: CoreMetrics): DerivedScores["metaAxes"] => ({
  voiceIntensity: computeWeightedScore([
    { metric: coreMetrics.voice.speakingRate },
    { metric: coreMetrics.voice.loudnessRange },
    { metric: coreMetrics.voice.pitchVariation },
  ]),
  conceptualDepth: computeWeightedScore([
    { metric: coreMetrics.language.concreteness, weight: CONCEPTUAL_DEPTH_WEIGHTS.concreteness },
    { metric: coreMetrics.language.metaphorDensity, weight: CONCEPTUAL_DEPTH_WEIGHTS.metaphorDensity },
    { metric: coreMetrics.language.references, weight: CONCEPTUAL_DEPTH_WEIGHTS.references },
  ]),
  narrativeStructureStrength: computeWeightedScore([
    { metric: coreMetrics.narrative.structureClarity },
    { metric: coreMetrics.narrative.hookPresence },
    { metric: coreMetrics.narrative.payoffDelivery },
  ]),
  visualDynamism: computeWeightedScore([
    { metric: coreMetrics.visual.cutRate },
    { metric: coreMetrics.visual.movement },
    { metric: coreMetrics.visual.expression },
  ]),
  productionPolish: computeWeightedScore([
    { metric: coreMetrics.voice.clarity },
    { metric: coreMetrics.visual.environmentStability },
    { metric: coreMetrics.sound.musicBalance },
  ]),
});

export const buildFallbackDerivedScores = (): DerivedScores => ({
  metaAxes: {
    voiceIntensity: unobservedDerivedScore(),
    conceptualDepth: unobservedDerivedScore(),
    narrativeStructureStrength: unobservedDerivedScore(),
    visualDynamism: unobservedDerivedScore(),
    productionPolish: unobservedDerivedScore(),
  },
  alignment: {
    audioVisualAlignment: unobservedDerivedScore(),
    beatsEditsAlignment: unobservedDerivedScore(),
    prosodySemanticAlignment: unobservedDerivedScore(),
    overallAlignment: unobservedDerivedScore(),
  },
  balance: {
    redundancyScore: unobservedDerivedScore(),
    complementarityScore: unobservedDerivedScore(),
    overRelianceScore: unobservedDerivedScore(),
    overallBalance: unobservedDerivedScore(),
  },
  cognitiveLoad: {
    averageLoad: unobservedDerivedScore(),
    peakLoad: unobservedDerivedScore(),
    loadVariance: unobservedDerivedScore(),
    overloadMoments: unobservedDerivedScore(),
  },
  secondOrder: {
    alignmentScore: unobservedDerivedScore(),
    driftScore: unobservedDerivedScore(),
    decayScore: unobservedDerivedScore(),
    balanceScore: unobservedDerivedScore(),
    timingScore: unobservedDerivedScore(),
  },
});

const isObservedMetric = (metric?: ScoredMetric) => {
  if (!metric) return false;
  if (metric.observed === true) return true;
  const value = typeof metric.value === "string" ? metric.value.trim().toLowerCase() : "";
  const hasValue = value !== "" && value !== "unobserved";
  const hasScore = typeof metric.score === "number" && metric.score > 0;
  return hasValue || hasScore;
};

const sanitizeTimeline = (timeline?: TimelinePoint[]) =>
  (timeline ?? []).filter((point) => Number.isFinite(point.timeSeconds) && Number.isFinite(point.value));

const timelineCapForDuration = (durationSeconds: number) => {
  if (durationSeconds <= 30) return 10;
  if (durationSeconds <= 60) return 15;
  if (durationSeconds <= 120) return 20;
  return 25;
};

const estimateTimelineCap = (timeline: TimelinePoint[]) => {
  if (timeline.length === 0) return 0;
  const maxTime = Math.max(...timeline.map((point) => point.timeSeconds));
  if (!Number.isFinite(maxTime)) return 0;
  return timelineCapForDuration(maxTime);
};

const computeTimelineWeight = (metric?: ScoredMetric): number => {
  if (!metric || !isObservedMetric(metric)) return 0;
  const timeline = sanitizeTimeline(metric.timeline);
  if (timeline.length > 0) {
    const cap = estimateTimelineCap(timeline);
    if (cap <= 0) return 0;
    return clamp(timeline.length / cap, 0, 1);
  }
  const itemsCount = metric.items?.length ?? 0;
  if (itemsCount > 0) {
    return clamp(itemsCount / 6, 0, 1);
  }
  return 0.5;
};

const deriveScoreFromTimeline = (metric: ScoredMetric): number => {
  const timeline = sanitizeTimeline(metric.timeline);
  if (timeline.length === 0) return metric.score;

  const maxValue = Math.max(...timeline.map((point) => point.value));
  const scale = Number.isFinite(maxValue) && maxValue <= 1.5 ? 100 : 1;
  const average = timeline.reduce((sum, point) => sum + point.value, 0) / timeline.length;
  return clamp(average * scale);
};

const blendAlignmentScore = (
  metric: ScoredMetric | undefined,
  fallback: DerivedScore,
): DerivedScore => {
  const hasAdvanced = isObservedMetric(metric);
  const hasFallback = fallback.observed;

  if (!hasAdvanced && !hasFallback) {
    return { value: 0, observed: false };
  }

  if (!hasAdvanced) {
    return fallback;
  }

  const advancedValue = metric ? deriveScoreFromTimeline(metric) : 0;
  const weight = computeTimelineWeight(metric);

  if (!hasFallback) {
    return { value: advancedValue, observed: true };
  }

  return {
    value: clamp(advancedValue * weight + fallback.value * (1 - weight)),
    observed: true,
  };
};

const deriveAlignmentFromDifference = (left: DerivedScore, right: DerivedScore): DerivedScore => {
  if (!left.observed || !right.observed) {
    return { value: 0, observed: false };
  }
  const diff = Math.abs(left.value - right.value);
  return { value: clamp(100 - diff), observed: true };
};

const aggregateDerivedScore = (inputs: Array<{ score: DerivedScore; weight?: number }>): DerivedScore => {
  if (inputs.length === 0) return { value: 0, observed: false };
  const observedInputs = inputs.filter((entry) => entry.score.observed);
  if (observedInputs.length === 0) return { value: 0, observed: false };

  const totalWeight = observedInputs.reduce((sum, entry) => sum + (entry.weight ?? 1), 0);
  const weightedValue =
    totalWeight > 0
      ? observedInputs.reduce((sum, entry) => sum + entry.score.value * (entry.weight ?? 1), 0) / totalWeight
      : 0;

  return {
    value: clamp(weightedValue),
    observed: observedInputs.length / inputs.length > 0.5,
  };
};

const computeVarianceScore = (metrics: SummaryMetric[]): DerivedScore => {
  const observedMetrics = metrics.filter((metric) => metric.observed);
  if (observedMetrics.length < 2) {
    return { value: 0, observed: false };
  }

  const values = observedMetrics.map((metric) => metric.score);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  const score = clamp(Math.sqrt(variance) * 2);

  return {
    value: score,
    observed: observedMetrics.length / metrics.length > 0.5,
  };
};

export const computeAlignmentScores = (
  core: CoreMetrics,
  advanced?: AdvancedFingerprintMetrics,
): DerivedScores["alignment"] => {
  const metaAxes = computeMetaAxes(core);
  const fallbackAudioVisual = deriveAlignmentFromDifference(metaAxes.voiceIntensity, metaAxes.visualDynamism);

  const fallbackBeatsEdits = computeWeightedScore([
    { metric: core.narrative.structureClarity, weight: 0.4 },
    { metric: core.narrative.transitionQuality, weight: 0.3 },
    { metric: core.visual.cutRate, weight: 0.3 },
  ]);

  const fallbackProsodySemantic = computeWeightedScore([
    { metric: core.voice.pitchVariation, weight: 0.4 },
    { metric: core.voice.pauseUsage, weight: 0.2 },
    { metric: core.language.concreteness, weight: 0.4 },
  ]);

  const audioVisualMetric = advanced?.visualEditAlignment?.audioVisualEmphasisAlignment;
  const beatsEditsMetric = advanced?.visualEditAlignment?.beatsVsEditsAlignment;
  const prosodyMetric =
    advanced?.visualEditAlignment?.prosodyVsSemanticImportanceAlignment ??
    advanced?.prosodyArc?.emphasisAlignmentScore;

  const audioVisualAlignment = blendAlignmentScore(audioVisualMetric, fallbackAudioVisual);
  const beatsEditsAlignment = blendAlignmentScore(beatsEditsMetric, fallbackBeatsEdits);
  const prosodySemanticAlignment = blendAlignmentScore(prosodyMetric, fallbackProsodySemantic);

  const overallAlignment = aggregateDerivedScore([
    { score: audioVisualAlignment, weight: 0.4 },
    { score: beatsEditsAlignment, weight: 0.3 },
    { score: prosodySemanticAlignment, weight: 0.3 },
  ]);

  return {
    audioVisualAlignment,
    beatsEditsAlignment,
    prosodySemanticAlignment,
    overallAlignment,
  };
};

export const computeBalanceScores = (
  core: CoreMetrics,
  skeleton: VideoSkeleton,
): DerivedScores["balance"] => {
  const metaAxes = computeMetaAxes(core);
  const contentMix = skeleton.contentMix;
  const mixValues = [
    contentMix.talkingHeadPct,
    contentMix.brollPct,
    contentMix.graphicsPct,
    contentMix.screencastPct,
    contentMix.otherPct,
  ];
  const mixTotal = mixValues.reduce((sum, value) => sum + value, 0);
  const maxMix = mixValues.length > 0 ? Math.max(...mixValues) : 0;

  const mixReliance: DerivedScore = {
    value: mixTotal > 0 ? clamp((maxMix - 50) * 2) : 0,
    observed: mixTotal > 0,
  };

  const modalitySpread = (() => {
    const axes = [metaAxes.voiceIntensity, metaAxes.conceptualDepth, metaAxes.visualDynamism];
    if (!axes.every((axis) => axis.observed)) {
      return { value: 0, observed: false };
    }
    const values = axes.map((axis) => axis.value);
    return {
      value: clamp(Math.max(...values) - Math.min(...values)),
      observed: true,
    };
  })();

  const overRelianceScore = aggregateDerivedScore([
    { score: mixReliance, weight: 0.6 },
    { score: modalitySpread, weight: 0.4 },
  ]);

  const languageVisual = (() => {
    if (!metaAxes.conceptualDepth.observed || !metaAxes.visualDynamism.observed) {
      return {
        balance: { value: 0, observed: false },
        synergy: { value: 0, observed: false },
        gap: { value: 0, observed: false },
      };
    }
    const language = metaAxes.conceptualDepth.value;
    const visual = metaAxes.visualDynamism.value;
    const balance = { value: clamp(100 - Math.abs(language - visual)), observed: true };
    const synergy = { value: clamp((language + visual) / 2), observed: true };
    const gap = { value: clamp((language - visual + 100) / 2), observed: true };
    return { balance, synergy, gap };
  })();

  const complementarityScore = aggregateDerivedScore([
    { score: languageVisual.balance, weight: 0.6 },
    { score: languageVisual.synergy, weight: 0.4 },
  ]);

  const redundancyScore = aggregateDerivedScore([
    { score: languageVisual.gap, weight: 0.6 },
    { score: overRelianceScore, weight: 0.4 },
  ]);

  const overallBalance = aggregateDerivedScore([
    { score: complementarityScore, weight: 0.5 },
    { score: { value: clamp(100 - overRelianceScore.value), observed: overRelianceScore.observed }, weight: 0.25 },
    { score: { value: clamp(100 - redundancyScore.value), observed: redundancyScore.observed }, weight: 0.25 },
  ]);

  return {
    redundancyScore,
    complementarityScore,
    overRelianceScore,
    overallBalance,
  };
};

const computeLoadStats = (metric?: ScoredMetric) => {
  if (!metric || !isObservedMetric(metric)) return null;
  const timeline = sanitizeTimeline(metric.timeline);
  if (timeline.length === 0) return null;

  const maxValue = Math.max(...timeline.map((point) => point.value));
  const scale = Number.isFinite(maxValue) && maxValue <= 1.5 ? 100 : 1;
  const values = timeline.map((point) => clamp(point.value * scale));
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const peak = Math.max(...values);
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / values.length;
  const varianceScore = clamp(Math.sqrt(variance) * 2);
  const overloadRatio = clamp((values.filter((value) => value >= 80).length / values.length) * 100);

  return { average, peak, varianceScore, overloadRatio };
};

const computeOverloadFromHighlights = (metric?: ScoredMetric): DerivedScore => {
  if (!metric || !isObservedMetric(metric)) return { value: 0, observed: false };
  const highlights = metric.spans ?? [];
  if (highlights.length === 0) return { value: 0, observed: false };
  return {
    value: clamp(highlights.length * 20),
    observed: true,
  };
};

export const computeCognitiveLoadScores = (
  core: CoreMetrics,
  advanced?: AdvancedFingerprintMetrics,
): DerivedScores["cognitiveLoad"] => {
  const loadStats = computeLoadStats(advanced?.cognitiveLoad?.loadPerSecond);

  const fallbackInputs = [
    { metric: core.voice.speakingRate, weight: 0.25 },
    { metric: core.visual.cutRate, weight: 0.25 },
    { metric: core.language.metaphorDensity, weight: 0.2 },
    { metric: invertSummaryMetric(core.narrative.structureClarity), weight: 0.2 },
    { metric: invertSummaryMetric(core.voice.pauseUsage), weight: 0.1 },
  ];
  const fallbackAverage = computeWeightedScore(fallbackInputs);
  const fallbackVariance = computeVarianceScore(fallbackInputs.map((entry) => entry.metric));
  const fallbackPeak = fallbackAverage.observed
    ? { value: clamp(fallbackAverage.value + 15), observed: true }
    : { value: 0, observed: false };
  const fallbackOverload = fallbackAverage.observed
    ? { value: clamp((fallbackAverage.value - 60) * 2.5), observed: true }
    : { value: 0, observed: false };

  const highlightOverload = computeOverloadFromHighlights(advanced?.cognitiveLoad?.loadHighlights);

  const averageLoad = loadStats
    ? { value: clamp(loadStats.average), observed: true }
    : fallbackAverage;
  const peakLoad = loadStats ? { value: clamp(loadStats.peak), observed: true } : fallbackPeak;
  const loadVariance = loadStats
    ? { value: clamp(loadStats.varianceScore), observed: true }
    : fallbackVariance;
  const overloadMoments = loadStats
    ? { value: clamp(loadStats.overloadRatio), observed: true }
    : highlightOverload.observed
      ? highlightOverload
      : fallbackOverload;

  return {
    averageLoad,
    peakLoad,
    loadVariance,
    overloadMoments,
  };
};

export const computeSecondOrderScores = (input: {
  core: CoreMetrics;
  alignment: DerivedScores["alignment"];
  balance: DerivedScores["balance"];
  cognitiveLoad: DerivedScores["cognitiveLoad"];
  advanced?: AdvancedFingerprintMetrics;
}): DerivedScores["secondOrder"] => {
  const driftFromAdvanced = computeWeightedScoredMetric([
    { metric: input.advanced?.prosodyArc?.energyDriftDbPerMin, weight: 0.35 },
    { metric: input.advanced?.prosodyArc?.paceVariabilityPct, weight: 0.25 },
    { metric: input.advanced?.narrativeArc?.segmentCohesionDrift, weight: 0.4 },
  ]);
  const driftFallback = computeWeightedScore([
    { metric: input.core.voice.pitchVariation, weight: 0.4 },
    { metric: input.core.voice.speakingRate, weight: 0.3 },
    { metric: invertSummaryMetric(input.core.narrative.transitionQuality), weight: 0.3 },
  ]);

  const decayFromAdvanced = computeWeightedScoredMetric([
    { metric: input.advanced?.prosodyArc?.withinSegmentPaceChangePct, weight: 0.4 },
    { metric: input.advanced?.prosodyArc?.energyDriftDbPerMin, weight: 0.3 },
    { metric: input.advanced?.cognitiveLoad?.loadPerSecond, weight: 0.3 },
  ]);
  const decayFallback = computeWeightedScore([
    { metric: invertSummaryMetric(input.core.narrative.payoffDelivery), weight: 0.4 },
    { metric: invertSummaryMetric(input.core.voice.clarity), weight: 0.3 },
    { metric: derivedScoreToSummaryMetric(input.cognitiveLoad.averageLoad), weight: 0.3 },
  ]);

  const timingFromAdvanced = (() => {
    const timeToHook = input.advanced?.narrativeArc?.timeToHookSeconds;
    const hookStrength = input.advanced?.narrativeArc?.hookStrengthScore;
    const beatsEdits = input.advanced?.visualEditAlignment?.beatsVsEditsAlignment;
    const silence = input.advanced?.visualEditAlignment?.silenceForEmphasisFidelity;
    const timeToHookScore = timeToHook && isObservedMetric(timeToHook)
      ? { value: clamp(100 - timeToHook.score / 2), observed: true }
      : { value: 0, observed: false };
    return aggregateDerivedScore([
      { score: timeToHookScore, weight: 0.25 },
      { score: { value: hookStrength?.score ?? 0, observed: isObservedMetric(hookStrength) }, weight: 0.25 },
      { score: { value: beatsEdits?.score ?? 0, observed: isObservedMetric(beatsEdits) }, weight: 0.25 },
      { score: { value: silence?.score ?? 0, observed: isObservedMetric(silence) }, weight: 0.25 },
    ]);
  })();

  const timingFallback = computeWeightedScore([
    { metric: input.core.narrative.hookPresence, weight: 0.4 },
    { metric: input.core.narrative.transitionQuality, weight: 0.3 },
    { metric: input.core.sound.silenceUsage, weight: 0.3 },
  ]);

  const alignmentScore = input.alignment.overallAlignment.observed
    ? input.alignment.overallAlignment
    : { value: 0, observed: false };
  const balanceScore = input.balance.overallBalance.observed
    ? input.balance.overallBalance
    : { value: 0, observed: false };
  const driftScore = driftFromAdvanced.observed ? driftFromAdvanced : driftFallback;
  const decayScore = decayFromAdvanced.observed ? decayFromAdvanced : decayFallback;
  const timingScore = timingFromAdvanced.observed ? timingFromAdvanced : timingFallback;

  return {
    alignmentScore,
    driftScore,
    decayScore,
    balanceScore,
    timingScore,
  };
};
