import { z } from "zod";
import type { VideoFingerprintJson } from "../types";

const axisScoreSchema = z.object({
  key: z.string().min(1, "axis key is required"),
  label: z.string().min(1, "axis label is required"),
  value: z.number().min(0).max(100),
});

const domainProfileSchema = z.object({
  archetype: z.string().min(1, "archetype is required"),
  summary: z.string().min(1, "summary is required"),
  description: z.string().default(""),
  axes: z.array(axisScoreSchema).min(1, "at least one axis score is required"),
  highlights: z.array(z.string().min(1)).optional(),
});

const metaAxesSchema = z.object({
  voiceIntensity: z.number().min(0).max(100),
  conceptualDepth: z.number().min(0).max(100),
  narrativeStructureStrength: z.number().min(0).max(100),
  visualDynamism: z.number().min(0).max(100),
  productionPolish: z.number().min(0).max(100),
});

export const fingerprintSchema = z.object({
  version: z.literal("1.0.0"),
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
