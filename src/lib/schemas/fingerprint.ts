import { z } from "zod";
import type { VideoFingerprintJson } from "../types";

const domainScoreSchema = z.object({
  key: z.string().min(1, "score key is required"),
  label: z.string().min(1, "score label is required"),
  value: z.number().min(0).max(100),
});

const domainProfileSchema = z.object({
  primaryArchetype: z.string().min(1, "primaryArchetype is required"),
  secondaryArchetype: z.string().min(1).optional(),
  summaryText: z.string().min(1, "summaryText is required"),
  scores: z.array(domainScoreSchema).min(1, "at least one score is required"),
  highlights: z.array(z.string().min(1)).optional(),
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

export const fingerprintSchema = z.object({
  version: z.literal("1.1.0"),
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
    })
    .optional(),
});

export type FingerprintSchema = z.infer<typeof fingerprintSchema>;

export function validateFingerprint(json: unknown): VideoFingerprintJson {
  const rawVersion = (json as any)?.version;
  if (rawVersion && rawVersion !== "1.1.0") {
    throw new Error(`Invalid fingerprint: unsupported version ${rawVersion}, expected 1.1.0`);
  }

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
