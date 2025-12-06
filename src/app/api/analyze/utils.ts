import prisma from "../../../lib/db";
import type { VideoFingerprintJson } from "../../../lib/types";
import { computeAverageMetaAxes, findNearestReferences } from "../../../lib/analysis/similarity";

export const safeParseFingerprint = (fingerprintText?: string | null): VideoFingerprintJson | null => {
  if (!fingerprintText) return null;
  try {
    return JSON.parse(fingerprintText) as VideoFingerprintJson;
  } catch {
    return null;
  }
};

export const fetchReferenceData = async (fingerprint: VideoFingerprintJson) => {
  const references = await prisma.videoAnalysis.findMany({
    where: { creator: { type: "reference" } },
    include: {
      creator: true,
      videoFingerprint: true,
    },
  });

  const parsedFingerprints: VideoFingerprintJson[] = [];

  const validReferences = references
    .map((analysis) => {
      const parsed = safeParseFingerprint(analysis.videoFingerprint?.fingerprint);
      if (!parsed) return null;
      parsedFingerprints.push(parsed);
      return {
        creatorId: analysis.creatorId,
        displayName: analysis.creator.displayName,
        fingerprint: parsed,
      };
    })
    .filter(Boolean) as Array<{ creatorId: string; displayName: string; fingerprint: VideoFingerprintJson }>;

  return {
    nearestReferences: findNearestReferences(fingerprint, validReferences, 3),
    averageMetaAxes: computeAverageMetaAxes(parsedFingerprints),
    referenceMetaAxes: parsedFingerprints.map((fp) => fp.metaAxes),
  };
};

