import prisma from "../../../lib/db";
import type { VideoFingerprintJson } from "../../../lib/types";
import type { FingerprintLoadError } from "../../../lib/analysis/types";
import { computeAverageMetaAxes, findNearestReferences } from "../../../lib/analysis/similarity";
import { validateFingerprint } from "../../../lib/schemas/fingerprint";
import { FINGERPRINT_SCHEMA_VERSION } from "../../../lib/schemas/fingerprintContract";
import { FINGERPRINT_SCHEMA_HASH } from "../../../lib/schemas/fingerprintSchemaHash";

export type FingerprintParseResult = {
  fingerprint: VideoFingerprintJson | null;
  error?: FingerprintLoadError;
};

const buildFingerprintLoadError = (
  code: FingerprintLoadError["code"],
  message: string,
  details?: string,
  version?: string,
  schemaHash?: string,
): FingerprintLoadError => ({
  code,
  message,
  details,
  version,
  schemaHash,
});

type FingerprintParseOptions = {
  expectedSchemaHash?: string | null;
  expectedSchemaVersion?: string | null;
};

const isLegacyVersion = (version?: string) => Boolean(version && version !== FINGERPRINT_SCHEMA_VERSION);

export const safeParseFingerprint = (
  fingerprintText?: string | null,
  options?: FingerprintParseOptions,
): FingerprintParseResult => {
  if (!fingerprintText) return { fingerprint: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(fingerprintText);
  } catch (error) {
    const details = error instanceof Error ? error.message : undefined;
    return {
      fingerprint: null,
      error: buildFingerprintLoadError(
        "invalid_json",
        "Stored fingerprint is corrupted. Please re-run analysis.",
        details,
      ),
    };
  }

  const parsedRecord = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  const version = parsedRecord && typeof parsedRecord.version === "string" ? parsedRecord.version : undefined;
  const schemaHash =
    parsedRecord && typeof parsedRecord.schemaHash === "string" ? parsedRecord.schemaHash : undefined;
  const expectedSchemaHash = options?.expectedSchemaHash ?? null;
  const expectedSchemaVersion = options?.expectedSchemaVersion ?? null;

  const hashMismatch = Boolean(expectedSchemaHash && expectedSchemaHash !== FINGERPRINT_SCHEMA_HASH);
  const versionMismatch = Boolean(
    expectedSchemaVersion && expectedSchemaVersion !== FINGERPRINT_SCHEMA_VERSION,
  );

  if ((hashMismatch || versionMismatch) && !isLegacyVersion(version)) {
    return {
      fingerprint: null,
      error: buildFingerprintLoadError(
        "invalid_schema",
        "Stored fingerprint is incompatible with the current schema. Please re-run analysis.",
        undefined,
        version,
        expectedSchemaHash ?? schemaHash ?? undefined,
      ),
    };
  }

  try {
    const fingerprint = validateFingerprint(parsed);
    return { fingerprint };
  } catch (error) {
    const details = error instanceof Error ? error.message : undefined;
    return {
      fingerprint: null,
      error: buildFingerprintLoadError(
        "invalid_schema",
        "Stored fingerprint is incompatible with the current schema. Please re-run analysis.",
        details,
        version,
        schemaHash,
      ),
    };
  }
};

export const attachFingerprintLoadError = (diagnostics: unknown, error?: FingerprintLoadError) => {
  if (!error) return diagnostics;
  if (diagnostics && typeof diagnostics === "object" && !Array.isArray(diagnostics)) {
    return { ...diagnostics, fingerprintLoadError: error };
  }
  return { fingerprintLoadError: error };
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
      const parsed = safeParseFingerprint(analysis.videoFingerprint?.fingerprint, {
        expectedSchemaHash: analysis.fingerprintSchemaHash,
        expectedSchemaVersion: analysis.fingerprintSchemaVersion,
      });
      if (!parsed.fingerprint) return null;
      parsedFingerprints.push(parsed.fingerprint);
      return {
        creatorId: analysis.creatorId,
        displayName: analysis.creator.displayName,
        fingerprint: parsed.fingerprint,
      };
    })
    .filter(Boolean) as Array<{ creatorId: string; displayName: string; fingerprint: VideoFingerprintJson }>;

  return {
    nearestReferences: findNearestReferences(fingerprint, validReferences, 3),
    averageMetaAxes: computeAverageMetaAxes(parsedFingerprints),
    referenceMetaAxes: parsedFingerprints.map((fp) => fp.metaAxes),
  };
};
