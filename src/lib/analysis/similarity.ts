import type { MetaAxes, ScoredMetric, VideoFingerprintJson } from "../types";

type AxisKey = keyof MetaAxes;
type DomainKey = "voice" | "language" | "narrative" | "visual" | "editing" | "sound";
type AxisStats = Record<AxisKey, { mean: number; std: number }>;
type SecondOrderKey = "alignmentScore" | "balanceScore" | "timingScore" | "driftScore" | "decayScore";
type SecondOrderStats = Record<SecondOrderKey, { mean: number; std: number }>;

const SECOND_ORDER_WEIGHT = 0.12; // small influence from alignment/balance/timing to avoid overpowering meta axes
const MIN_STD = 6;

const AXIS_KEYS: AxisKey[] = [
  "voiceIntensity",
  "conceptualDepth",
  "narrativeStructureStrength",
  "visualDynamism",
  "productionPolish",
];

const DOMAIN_WEIGHTS: Record<DomainKey, number> = {
  voice: 1.05,
  language: 1.1,
  narrative: 1.15,
  visual: 1.0,
  editing: 0.95,
  sound: 0.9,
};

const AXIS_DOMAIN_MAP: Record<AxisKey, DomainKey[]> = {
  voiceIntensity: ["voice"],
  conceptualDepth: ["language"],
  narrativeStructureStrength: ["narrative"],
  visualDynamism: ["visual", "editing"],
  productionPolish: ["editing", "sound"],
};

const DEFAULT_AXIS_WEIGHTS: Record<AxisKey, number> = {
  voiceIntensity: DOMAIN_WEIGHTS.voice,
  conceptualDepth: DOMAIN_WEIGHTS.language,
  narrativeStructureStrength: DOMAIN_WEIGHTS.narrative,
  visualDynamism: (DOMAIN_WEIGHTS.visual + DOMAIN_WEIGHTS.editing) / 2,
  productionPolish: (DOMAIN_WEIGHTS.editing + DOMAIN_WEIGHTS.sound) / 2,
};

const SECOND_ORDER_KEYS: SecondOrderKey[] = [
  "alignmentScore",
  "balanceScore",
  "timingScore",
  "driftScore",
  "decayScore",
];

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const clampStd = (value: number) => (value > MIN_STD ? value : MIN_STD);

const computeStats = (values: number[]) => {
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return { mean, std: clampStd(Math.sqrt(variance)) };
};

const isObservedMetric = (metric?: ScoredMetric) =>
  metric?.observed === true || (typeof metric?.score === "number" && metric.score > 0);

const collectAxisDetails = (fingerprint?: VideoFingerprintJson) => {
  if (!fingerprint) return undefined;
  if (fingerprint.supporting?.axisDetails) return fingerprint.supporting.axisDetails;
  const combined: Record<string, { observed?: boolean }> = {};
  for (const profile of Object.values(fingerprint.perDomain)) {
    if (!profile.axisDetails) continue;
    for (const [key, detail] of Object.entries(profile.axisDetails) as [string, { observed?: boolean }][]) {
      if (!combined[key]) combined[key] = detail;
    }
  }
  return Object.keys(combined).length ? combined : undefined;
};

const domainCoverage = (fingerprint: VideoFingerprintJson | undefined, domain: DomainKey) => {
  const axisDetails = collectAxisDetails(fingerprint);
  if (!axisDetails) return 1;
  const entries = Object.entries(axisDetails).filter(([key]) => key.startsWith(`${domain}.`));
  if (!entries.length) return 0;
  const observed = entries.filter(([, detail]) => detail?.observed !== false).length;
  return observed / entries.length;
};

const axisCoverage = (fingerprint: VideoFingerprintJson | undefined, axis: AxisKey) => {
  const domains = AXIS_DOMAIN_MAP[axis];
  if (!domains.length) return 1;
  return average(domains.map((domain) => domainCoverage(fingerprint, domain)));
};

const buildAxisStats = (references: VideoFingerprintJson[]): AxisStats => {
  const stats = {} as AxisStats;
  for (const axis of AXIS_KEYS) {
    const values = references
      .filter((fp) => axisCoverage(fp, axis) > 0)
      .map((fp) => fp.metaAxes[axis]);
    stats[axis] = computeStats(values.length ? values : references.map((fp) => fp.metaAxes[axis]));
  }
  return stats;
};

const buildSecondOrderStats = (references: VideoFingerprintJson[]): SecondOrderStats => {
  const stats = {} as SecondOrderStats;
  for (const key of SECOND_ORDER_KEYS) {
    const values = references
      .map((fp) => fp.secondOrder?.[key])
      .filter(isObservedMetric)
      .map((metric) => metric.score);
    stats[key] = computeStats(values.length ? values : [0]);
  }
  return stats;
};

const normalizeValue = (value: number, stats: { mean: number; std: number }) => (value - stats.mean) / stats.std;

export const distanceOnMetaAxes = (
  target: VideoFingerprintJson["metaAxes"],
  candidate: VideoFingerprintJson["metaAxes"],
  options?: {
    axisStats?: AxisStats;
    secondOrderStats?: SecondOrderStats;
    targetFingerprint?: VideoFingerprintJson;
    candidateFingerprint?: VideoFingerprintJson;
    axisWeights?: Partial<Record<AxisKey, number>>;
  },
) => {
  const axisStats = options?.axisStats;
  const axisWeights = { ...DEFAULT_AXIS_WEIGHTS, ...options?.axisWeights };

  const weighted = AXIS_KEYS.reduce(
    (acc, axis) => {
      const targetValue = axisStats ? normalizeValue(target[axis], axisStats[axis]) : target[axis];
      const candidateValue = axisStats ? normalizeValue(candidate[axis], axisStats[axis]) : candidate[axis];
      const coverage = Math.min(
        axisCoverage(options?.targetFingerprint, axis),
        axisCoverage(options?.candidateFingerprint, axis),
      );
      if (coverage <= 0) return acc;
      const delta = targetValue - candidateValue;
      const weight = axisWeights[axis] * coverage;
      acc.sumSq += weight * delta * delta;
      acc.weight += weight;
      return acc;
    },
    { sumSq: 0, weight: 0 },
  );

  const base = weighted.weight > 0 ? Math.sqrt(weighted.sumSq / weighted.weight) : 0;

  const secondOrderStats = options?.secondOrderStats;
  const secondOrderPairs = SECOND_ORDER_KEYS.map((key) => {
    const targetMetric = options?.targetFingerprint?.secondOrder?.[key];
    const candidateMetric = options?.candidateFingerprint?.secondOrder?.[key];
    if (!targetMetric || !candidateMetric || !isObservedMetric(targetMetric) || !isObservedMetric(candidateMetric)) return null;
    const targetValue = secondOrderStats ? normalizeValue(targetMetric.score, secondOrderStats[key]) : targetMetric.score;
    const candidateValue = secondOrderStats
      ? normalizeValue(candidateMetric.score, secondOrderStats[key])
      : candidateMetric.score;
    return targetValue - candidateValue;
  }).filter((value): value is number => value !== null);

  if (!secondOrderPairs.length) return base;

  const secondMagnitude = Math.sqrt(average(secondOrderPairs.map((value) => value * value)));
  return base + SECOND_ORDER_WEIGHT * secondMagnitude;
};

export const computeAverageMetaAxes = (
  fingerprints: VideoFingerprintJson[],
): VideoFingerprintJson["metaAxes"] | null => {
  if (!fingerprints.length) return null;
  const totals = fingerprints.reduce(
    (acc, fp) => ({
      voiceIntensity: acc.voiceIntensity + fp.metaAxes.voiceIntensity,
      conceptualDepth: acc.conceptualDepth + fp.metaAxes.conceptualDepth,
      narrativeStructureStrength:
        acc.narrativeStructureStrength + fp.metaAxes.narrativeStructureStrength,
      visualDynamism: acc.visualDynamism + fp.metaAxes.visualDynamism,
      productionPolish: acc.productionPolish + fp.metaAxes.productionPolish,
    }),
    {
      voiceIntensity: 0,
      conceptualDepth: 0,
      narrativeStructureStrength: 0,
      visualDynamism: 0,
      productionPolish: 0,
    },
  );
  const count = fingerprints.length || 1;
  return {
    voiceIntensity: totals.voiceIntensity / count,
    conceptualDepth: totals.conceptualDepth / count,
    narrativeStructureStrength: totals.narrativeStructureStrength / count,
    visualDynamism: totals.visualDynamism / count,
    productionPolish: totals.productionPolish / count,
  };
};

export const findNearestReferences = (
  target: VideoFingerprintJson,
  references: Array<{ creatorId: string; displayName: string; fingerprint: VideoFingerprintJson }>,
  limit = 3,
) => {
  const axisStats = buildAxisStats(references.map((ref) => ref.fingerprint));
  const secondOrderStats = buildSecondOrderStats(references.map((ref) => ref.fingerprint));
  const distances = references.map((ref) => ({
    creatorId: ref.creatorId,
    displayName: ref.displayName,
    distance: distanceOnMetaAxes(target.metaAxes, ref.fingerprint.metaAxes, {
      targetFingerprint: target,
      candidateFingerprint: ref.fingerprint,
      axisStats,
      secondOrderStats,
    }),
  }));
  return distances.sort((a, b) => a.distance - b.distance).slice(0, limit);
};
