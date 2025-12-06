import type { VideoFingerprintJson } from "../types";

export const distanceOnMetaAxes = (
  target: VideoFingerprintJson["metaAxes"],
  candidate: VideoFingerprintJson["metaAxes"],
) => {
  const deltas = [
    target.voiceIntensity - candidate.voiceIntensity,
    target.conceptualDepth - candidate.conceptualDepth,
    target.narrativeStructureStrength - candidate.narrativeStructureStrength,
    target.visualDynamism - candidate.visualDynamism,
    target.productionPolish - candidate.productionPolish,
  ];
  const sumSq = deltas.reduce((sum, value) => sum + value * value, 0);
  return Math.sqrt(sumSq);
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
    distance: distanceOnMetaAxes(target.metaAxes, ref.fingerprint.metaAxes),
  }));
  return distances.sort((a, b) => a.distance - b.distance).slice(0, limit);
};
