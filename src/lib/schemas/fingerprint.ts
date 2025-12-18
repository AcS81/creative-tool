import { z } from "zod";
import { buildDefaultAdvancedMetrics } from "../analysis/fingerprint/defaults";
import type { AdvancedFingerprintMetrics, LegacyVideoFingerprintJson, VideoFingerprintJson } from "../types";

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

const prosodyArcSchema = z.object({
  paceMeanWpm: scoredMetricSchema,
  paceVariabilityPct: scoredMetricSchema,
  withinSegmentPaceChangePct: scoredMetricSchema,
  emphasisAlignmentScore: scoredMetricSchema,
  energyDriftDbPerMin: scoredMetricSchema,
});

const languageTextureSchema = z.object({
  analogyExampleDefinitionRatio: scoredMetricSchema,
  sentenceCompressionRatio: scoredMetricSchema,
  humorTimingScore: scoredMetricSchema,
  referenceDensityPerMin: scoredMetricSchema,
  questionRate: scoredMetricSchema,
});

const narrativeArcSchema = z.object({
  timeToHookSeconds: scoredMetricSchema,
  hookStrengthScore: scoredMetricSchema,
  segmentCohesionDrift: scoredMetricSchema,
  openLoopsUnresolvedRatio: scoredMetricSchema,
  endingResolutionScore: scoredMetricSchema,
});

const visualEditAlignmentSchema = z.object({
  visualEntropy: scoredMetricSchema,
  cutRateRefinement: scoredMetricSchema,
  silenceForEmphasisFidelity: scoredMetricSchema,
  audioVisualEmphasisAlignment: scoredMetricSchema,
  beatsVsEditsAlignment: scoredMetricSchema,
  prosodyVsSemanticImportanceAlignment: scoredMetricSchema,
});

const modalityBalanceSchema = z.object({
  redundancyVsComplementarity: scoredMetricSchema,
  modalityOverReliance: scoredMetricSchema,
});

const cognitiveLoadSchema = z.object({
  loadPerSecond: scoredMetricSchema,
  loadHighlights: scoredMetricSchema,
});

const secondOrderSchema = z.object({
  alignmentScore: scoredMetricSchema,
  driftScore: scoredMetricSchema,
  decayScore: scoredMetricSchema,
  balanceScore: scoredMetricSchema,
  timingScore: scoredMetricSchema,
});

const advancedMetricsShape = {
  prosodyArc: prosodyArcSchema,
  languageTexture: languageTextureSchema,
  narrativeArc: narrativeArcSchema,
  visualEditAlignment: visualEditAlignmentSchema,
  modalityBalance: modalityBalanceSchema,
  cognitiveLoad: cognitiveLoadSchema,
  secondOrder: secondOrderSchema,
};

const fingerprintVersionSchema = z.literal("1.3.0");

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
    })
    .optional(),
  performanceProfile: performanceProfileSchema.optional(),
  hasPerformanceData: z.boolean().optional().default(false),
};

export const fingerprintSchema = z.object({
  version: fingerprintVersionSchema,
  ...baseFingerprintShape,
  ...advancedMetricsShape,
});

const legacyFingerprintSchemaV12 = z.object({
  version: z.literal("1.2.0"),
  ...baseFingerprintShape,
});

const legacyFingerprintSchemaV11 = z.object({
  version: z.literal("1.1.0"),
  ...baseFingerprintShape,
});

export type FingerprintSchema = z.infer<typeof fingerprintSchema>;

const buildDefaultAdvancedSections = (overrides?: Partial<AdvancedFingerprintMetrics>) => {
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

const upgradeLegacyFingerprint = (legacy: LegacyVideoFingerprintJson): VideoFingerprintJson => {
  const upgraded = {
    ...legacy,
    ...buildDefaultAdvancedSections(),
    version: "1.3.0" as const,
    hasPerformanceData: legacy.hasPerformanceData ?? Boolean(legacy.performanceProfile),
  };
  return fingerprintSchema.parse(upgraded);
};

export function validateFingerprint(json: unknown): VideoFingerprintJson {
  const parsed = fingerprintSchema.safeParse(json);
  if (parsed.success) {
    return {
      ...parsed.data,
      hasPerformanceData: parsed.data.hasPerformanceData ?? Boolean(parsed.data.performanceProfile),
    };
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
  return legacyFingerprintSchemaV12.safeParse(json).success || legacyFingerprintSchemaV11.safeParse(json).success;
}
