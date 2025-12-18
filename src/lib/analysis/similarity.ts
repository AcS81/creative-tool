import type { VideoFingerprintJson } from "../types";

const SECOND_ORDER_WEIGHT = 0.12; // small influence from alignment/balance/timing to avoid overpowering meta axes

export const distanceOnMetaAxes = (
  target: VideoFingerprintJson["metaAxes"],
  candidate: VideoFingerprintJson["metaAxes"],
  options?: { targetFingerprint?: VideoFingerprintJson; candidateFingerprint?: VideoFingerprintJson },
) => {
  const deltas = [
    target.voiceIntensity - candidate.voiceIntensity,
    target.conceptualDepth - candidate.conceptualDepth,
    target.narrativeStructureStrength - candidate.narrativeStructureStrength,
    target.visualDynamism - candidate.visualDynamism,
    target.productionPolish - candidate.productionPolish,
  ];
  const sumSq = deltas.reduce((sum, value) => sum + value * value, 0);
  const base = Math.sqrt(sumSq);

  const secondOrderVector = (fp?: VideoFingerprintJson) => {
    if (!fp?.secondOrder) return [] as number[];
    const { alignmentScore, balanceScore, timingScore, driftScore } = fp.secondOrder;
    return [alignmentScore, balanceScore, timingScore, driftScore]
      .map((metric) => (typeof metric?.score === "number" ? metric.score : null))
      .filter((v): v is number => v !== null);
  };

  const targetSecond = secondOrderVector(options?.targetFingerprint);
  const candidateSecond = secondOrderVector(options?.candidateFingerprint);

  const secondPairs = targetSecond
    .map((value, idx) => {
      const candidateValue = candidateSecond[idx];
      if (typeof candidateValue !== "number") return null;
      return value - candidateValue;
    })
    .filter((v): v is number => v !== null);

  if (!secondPairs.length) return base;

  const secondMagnitude = Math.sqrt(secondPairs.reduce((sum, v) => sum + v * v, 0));
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
  const distances = references.map((ref) => ({
    creatorId: ref.creatorId,
    displayName: ref.displayName,
    distance: distanceOnMetaAxes(target.metaAxes, ref.fingerprint.metaAxes, {
      targetFingerprint: target,
      candidateFingerprint: ref.fingerprint,
    }),
  }));
  return distances.sort((a, b) => a.distance - b.distance).slice(0, limit);
};
