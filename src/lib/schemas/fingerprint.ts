import { z } from "zod";
import { buildDefaultAdvancedMetrics } from "../analysis/fingerprint/defaults";
import { ADVANCED_METRIC_SECTIONS, SECOND_ORDER_METRICS, type AdvancedSectionKey } from "../analysis/metricRegistry";
import type { AdvancedFingerprintMetrics, LegacyVideoFingerprintJson, VideoFingerprintJson } from "../types";
import { FINGERPRINT_SCHEMA_VERSION } from "./fingerprintContract";

const LEGACY_FINGERPRINT_V13 = "1.3.0" as const;
const LEGACY_FINGERPRINT_V12 = "1.2.0" as const;
const LEGACY_FINGERPRINT_V11 = "1.1.0" as const;

const resolveHasPerformanceData = (hasPerformanceData: boolean | undefined, performanceProfile?: unknown) =>
  Boolean(performanceProfile) || hasPerformanceData === true;

const domainScoreSchema = z.object({
  key: z.string().min(1, "score key is required"),
  label: z.string().min(1, "score label is required"),
  value: z.number().min(0).max(100),
});

const axisDetailSchema = z.object({
  rawValue: z.string(),
  explanation: z.string().optional(),
  observed: z.boolean().optional(),
});

const domainProfileSchema = z.object({
  primaryArchetype: z.string().min(1, "primaryArchetype is required"),
  secondaryArchetype: z.string().min(1).optional(),
  summaryText: z.string().min(1, "summaryText is required"),
  scores: z.array(domainScoreSchema).min(1, "at least one score is required"),
  highlights: z.array(z.string().min(1)).optional(),
  axisDetails: z.record(z.string(), axisDetailSchema).optional(),
});

const metaAxesSchema = z.object({
  voiceIntensity: z.number().min(0).max(100),
  conceptualDepth: z.number().min(0).max(100),
  narrativeStructureStrength: z.number().min(0).max(100),
  visualDynamism: z.number().min(0).max(100),
  productionPolish: z.number().min(0).max(100),
});

const derivedScoreSchema = z.object({
  value: z.number().min(0).max(100),
  observed: z.boolean(),
});

const derivedScoresSchema = z.object({
  metaAxes: z.object({
    voiceIntensity: derivedScoreSchema,
    conceptualDepth: derivedScoreSchema,
    narrativeStructureStrength: derivedScoreSchema,
    visualDynamism: derivedScoreSchema,
    productionPolish: derivedScoreSchema,
  }),
  alignment: z.object({
    audioVisualAlignment: derivedScoreSchema,
    beatsEditsAlignment: derivedScoreSchema,
    prosodySemanticAlignment: derivedScoreSchema,
    overallAlignment: derivedScoreSchema,
  }),
  balance: z.object({
    redundancyScore: derivedScoreSchema,
    complementarityScore: derivedScoreSchema,
    overRelianceScore: derivedScoreSchema,
    overallBalance: derivedScoreSchema,
  }),
  cognitiveLoad: z.object({
    averageLoad: derivedScoreSchema,
    peakLoad: derivedScoreSchema,
    loadVariance: derivedScoreSchema,
    overloadMoments: derivedScoreSchema,
  }),
  secondOrder: z.object({
    alignmentScore: derivedScoreSchema,
    driftScore: derivedScoreSchema,
    decayScore: derivedScoreSchema,
    balanceScore: derivedScoreSchema,
    timingScore: derivedScoreSchema,
  }),
});

const segmentSchema = z.object({
  startSeconds: z.number().min(0),
  endSeconds: z.number().min(0),
});

const retentionPointSchema = z.object({
  timeRatio: z.number().min(0).max(1),
  audienceRetention: z.number().min(0).max(100),
});

const performanceScoresSchema = z.object({
  hookRetention: z.number().min(0).max(100),
  midVideoRetentionStability: z.number().min(0).max(100),
  lateDropOffSeverity: z.number().min(0).max(100),
  clickThroughRateQuality: z.number().min(0).max(100),
});

const performanceMetricsSchema = z.object({
  views: z.number().nonnegative().optional(),
  likes: z.number().nonnegative().optional(),
  comments: z.number().nonnegative().optional(),
  ctr: z.number().min(0).max(100).optional(),
  avgViewDurationSeconds: z.number().nonnegative().optional(),
  retentionSeries: z.array(retentionPointSchema).max(200).optional(),
});

const performanceProfileSchema = z.object({
  scores: performanceScoresSchema,
  metrics: performanceMetricsSchema,
  summaryText: z.string().min(1, "summaryText is required"),
  insights: z.array(z.string().min(1)).optional(),
});

const timelinePointSchema = z.object({
  timeSeconds: z.number().min(0),
  value: z.number(),
  label: z.string().optional(),
});

const spanSchema = z.object({
  startSeconds: z.number().min(0),
  endSeconds: z.number().min(0),
  value: z.number().optional(),
  label: z.string().optional(),
  alignedBeat: z.string().optional(),
  alignedPunchline: z.boolean().optional(),
});

const segmentDeltaSchema = z.object({
  startSeconds: z.number().min(0),
  endSeconds: z.number().min(0),
  deltaPct: z.number().optional(),
  label: z.string().optional(),
});

const scoredMetricSchema = z.object({
  score: z.number().min(0).max(100),
  value: z.string().optional(),
  observed: z.boolean().optional(),
  timeline: z.array(timelinePointSchema).optional(),
  spans: z.array(spanSchema).optional(),
  segments: z.array(segmentDeltaSchema).optional(),
  items: z.array(z.record(z.string(), z.any())).optional(),
  proportions: z.record(z.string(), z.number()).optional(),
  counts: z.record(z.string(), z.number()).optional(),
  trend: z.number().optional(),
});

const buildSectionSchema = (keys: readonly string[]) =>
  z.object(Object.fromEntries(keys.map((key) => [key, scoredMetricSchema])));

const advancedMetricsShape = {
  ...Object.fromEntries(
    (Object.entries(ADVANCED_METRIC_SECTIONS) as Array<[AdvancedSectionKey, readonly string[]]>).map(
      ([section, keys]) => [section, buildSectionSchema(keys)],
    ),
  ),
  secondOrder: buildSectionSchema(SECOND_ORDER_METRICS),
} as {
  [K in AdvancedSectionKey]: z.ZodObject<Record<string, typeof scoredMetricSchema>>;
} & { secondOrder: z.ZodObject<Record<string, typeof scoredMetricSchema>> };

const fingerprintVersionSchema = z.literal(FINGERPRINT_SCHEMA_VERSION);

const baseFingerprintShape = {
  createdAt: z
    .string()
    .datetime({ offset: true, message: "createdAt must be an ISO datetime string" }),
  metaAxes: metaAxesSchema,
  perDomain: z.object({
    voiceProfile: domainProfileSchema,
    languageProfile: domainProfileSchema,
    narrativeProfile: domainProfileSchema,
    visualProfile: domainProfileSchema,
    editingProfile: domainProfileSchema,
    soundProfile: domainProfileSchema,
  }),
  overallArchetype: z.string().min(1).optional(),
  supporting: z
    .object({
      transcriptSegments: z
        .array(
          segmentSchema.extend({
            text: z.string().min(1),
          }),
        )
        .optional(),
      sceneSegments: z
        .array(
          segmentSchema.extend({
            label: z.string().min(1),
            shortSummary: z.string().min(1),
          }),
        )
        .optional(),
      beats: z
        .array(
          segmentSchema.extend({
            label: z.string().min(1),
            role: z.enum(["hook", "setup", "escalation", "payoff", "outro", "cta", "break"]).optional(),
            devices: z.array(z.string().min(1)).default([]),
          }),
        )
        .optional(),
      axisDetails: z.record(z.string(), axisDetailSchema).optional(),
      perChapterMetrics: z.array(z.record(z.string(), z.any())).optional(),
      advancedSegments: z.array(z.record(z.string(), z.any())).optional(),
    })
    .optional(),
  performanceProfile: performanceProfileSchema.optional(),
  hasPerformanceData: z.boolean().optional().default(false),
  derivedScores: derivedScoresSchema.optional(),
};

export const fingerprintSchema = z.object({
  version: fingerprintVersionSchema,
  ...baseFingerprintShape,
  ...advancedMetricsShape,
});

const legacyFingerprintSchemaV13 = z
  .object({
    version: z.literal(LEGACY_FINGERPRINT_V13),
    ...baseFingerprintShape,
  })
  .passthrough();

const legacyFingerprintSchemaV12 = z
  .object({
    version: z.literal(LEGACY_FINGERPRINT_V12),
    ...baseFingerprintShape,
  })
  .passthrough();

const legacyFingerprintSchemaV11 = z
  .object({
    version: z.literal(LEGACY_FINGERPRINT_V11),
    ...baseFingerprintShape,
  })
  .passthrough();

export type FingerprintSchema = z.infer<typeof fingerprintSchema>;
type LegacyFingerprintV13 = z.infer<typeof legacyFingerprintSchemaV13>;
type LegacyFingerprintV12 = z.infer<typeof legacyFingerprintSchemaV12>;
type LegacyFingerprintV11 = z.infer<typeof legacyFingerprintSchemaV11>;

const pickAdvancedOverrides = (legacy: Partial<AdvancedFingerprintMetrics>) => ({
  prosodyArc: legacy.prosodyArc,
  languageTexture: legacy.languageTexture,
  narrativeArc: legacy.narrativeArc,
  visualEditAlignment: legacy.visualEditAlignment,
  modalityBalance: legacy.modalityBalance,
  cognitiveLoad: legacy.cognitiveLoad,
  secondOrder: legacy.secondOrder,
});

const buildDefaultAdvancedSections = (overrides?: Partial<AdvancedFingerprintMetrics>) => {
  const base = buildDefaultAdvancedMetrics();
  return {
    prosodyArc: { ...base.prosodyArc, ...overrides?.prosodyArc },
    languageTexture: { ...base.languageTexture, ...overrides?.languageTexture },
    narrativeArc: { ...base.narrativeArc, ...overrides?.narrativeArc },
    visualEditAlignment: { ...base.visualEditAlignment, ...overrides?.visualEditAlignment },
    modalityBalance: { ...base.modalityBalance, ...overrides?.modalityBalance },
    cognitiveLoad: { ...base.cognitiveLoad, ...overrides?.cognitiveLoad },
    secondOrder: { ...base.secondOrder, ...overrides?.secondOrder },
  };
};

const upgradeV11ToV12 = (legacy: LegacyFingerprintV11): LegacyFingerprintV12 => ({
  ...legacy,
  version: LEGACY_FINGERPRINT_V12,
  hasPerformanceData: resolveHasPerformanceData(legacy.hasPerformanceData, legacy.performanceProfile),
});

const upgradeV12ToV13 = (legacy: LegacyFingerprintV12 & Partial<AdvancedFingerprintMetrics>): LegacyFingerprintV13 & Partial<AdvancedFingerprintMetrics> => {
  return {
    ...legacy,
    ...buildDefaultAdvancedSections(pickAdvancedOverrides(legacy)),
    version: LEGACY_FINGERPRINT_V13,
    hasPerformanceData: resolveHasPerformanceData(legacy.hasPerformanceData, legacy.performanceProfile),
  };
};

const upgradeV13ToV14 = (legacy: LegacyFingerprintV13 & Partial<AdvancedFingerprintMetrics>): VideoFingerprintJson => {
  const upgraded = {
    ...legacy,
    version: FINGERPRINT_SCHEMA_VERSION,
    // derivedScores is optional, so we don't need to add it here
    // It will be computed and added during analysis
  };
  return fingerprintSchema.parse(upgraded) as unknown as VideoFingerprintJson;
};

const upgradeLegacyFingerprint = (legacy: LegacyVideoFingerprintJson): VideoFingerprintJson => {
  if (legacy.version === LEGACY_FINGERPRINT_V13) {
    return upgradeV13ToV14(legacy as LegacyFingerprintV13 & Partial<AdvancedFingerprintMetrics>);
  }
  if (legacy.version === LEGACY_FINGERPRINT_V12) {
    const upgradedV13 = upgradeV12ToV13(legacy as LegacyFingerprintV12 & Partial<AdvancedFingerprintMetrics>);
    return upgradeV13ToV14(upgradedV13);
  }
  if (legacy.version === LEGACY_FINGERPRINT_V11) {
    const upgradedV12 = upgradeV11ToV12(legacy as LegacyFingerprintV11);
    const upgradedV13 = upgradeV12ToV13(upgradedV12);
    return upgradeV13ToV14(upgradedV13);
  }
  throw new Error(`Unsupported fingerprint version: ${legacy.version}`);
};

export function validateFingerprint(json: unknown): VideoFingerprintJson {
  const parsed = fingerprintSchema.safeParse(json);
  if (parsed.success) {
    const result = {
      ...parsed.data,
      hasPerformanceData: resolveHasPerformanceData(parsed.data.hasPerformanceData, parsed.data.performanceProfile),
    };
    return result as unknown as VideoFingerprintJson;
  }

  const legacyParsedV13 = legacyFingerprintSchemaV13.safeParse(json);
  if (legacyParsedV13.success) {
    return upgradeLegacyFingerprint(legacyParsedV13.data as LegacyVideoFingerprintJson);
  }

  const legacyParsedV12 = legacyFingerprintSchemaV12.safeParse(json);
  if (legacyParsedV12.success) {
    return upgradeLegacyFingerprint(legacyParsedV12.data as LegacyVideoFingerprintJson);
  }

  const legacyParsedV11 = legacyFingerprintSchemaV11.safeParse(json);
  if (legacyParsedV11.success) {
    return upgradeLegacyFingerprint(legacyParsedV11.data as LegacyVideoFingerprintJson);
  }

  const message = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid fingerprint: ${message}`);
}

export function isValidFingerprint(json: unknown): json is VideoFingerprintJson {
  if (fingerprintSchema.safeParse(json).success) return true;
  return legacyFingerprintSchemaV13.safeParse(json).success || legacyFingerprintSchemaV12.safeParse(json).success || legacyFingerprintSchemaV11.safeParse(json).success;
}
