import { z } from "zod";
import type { VideoFingerprintJson } from "../types";

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

const fingerprintVersionSchema = z.union([z.literal("1.1.0"), z.literal("1.2.0")]);

export const fingerprintSchema = z.object({
  version: fingerprintVersionSchema,
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
            devices: z.array(z.string().min(1)).default([]),
          }),
        )
        .optional(),
      axisDetails: z.record(z.string(), axisDetailSchema).optional(),
    })
    .optional(),
  performanceProfile: performanceProfileSchema.optional(),
  hasPerformanceData: z.boolean().optional().default(false),
});

export type FingerprintSchema = z.infer<typeof fingerprintSchema>;

export function validateFingerprint(json: unknown): VideoFingerprintJson {
  const parsed = fingerprintSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid fingerprint: ${message}`);
  }
  return parsed.data;
}

export function isValidFingerprint(json: unknown): json is VideoFingerprintJson {
  return fingerprintSchema.safeParse(json).success;
}
