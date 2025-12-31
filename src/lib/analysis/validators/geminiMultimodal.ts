import { z } from "zod";
import type {
  GeminiAdvancedMetrics,
  GeminiAdvancedMetricsPartial,
  GeminiBeat,
  GeminiMultimodalResponse,
  GeminiObservedMetric,
  GeminiRichMetric,
} from "../types/multimodal";
import { ADVANCED_METRIC_SECTIONS, BASE_DOMAIN_METRICS, type AdvancedSectionKey } from "../metricRegistry";

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

const observedMetricSchema: z.ZodType<GeminiObservedMetric> = z.object({
  score: z.number().min(0).max(100),
  value: z.string().min(1),
  explanation: z.string().min(1),
});

const richMetricSchema: z.ZodType<GeminiRichMetric> = observedMetricSchema.extend({
  observed: z.boolean().optional(),
  timeline: z.array(timelinePointSchema).optional(),
  spans: z.array(spanSchema).optional(),
  segments: z.array(segmentDeltaSchema).optional(),
  items: z.array(z.record(z.string(), z.any())).optional(),
  proportions: z.record(z.string(), z.number()).optional(),
  counts: z.record(z.string(), z.number()).optional(),
  trend: z.number().optional(),
});

const beatSchema: z.ZodType<GeminiBeat> = z
  .object({
    label: z.string().min(1),
    start: z.number().min(0),
    end: z.number().min(0),
    role: z.string().min(1).optional(),
  })
  .refine((val) => val.end >= val.start, {
    message: "end must be greater than or equal to start",
    path: ["end"],
  });

const buildObservedMetricFields = (keys: readonly string[]) =>
  Object.fromEntries(keys.map((key) => [key, observedMetricSchema])) as Record<
    string,
    z.ZodType<GeminiObservedMetric>
  >;

const buildRichMetricFields = (keys: readonly string[]) =>
  Object.fromEntries(keys.map((key) => [key, richMetricSchema])) as Record<
    string,
    z.ZodType<GeminiRichMetric>
  >;

const voiceSchema = z.object(buildObservedMetricFields(BASE_DOMAIN_METRICS.voice)).passthrough();

const languageSchema = z.object(buildObservedMetricFields(BASE_DOMAIN_METRICS.language)).passthrough();

const narrativeSchema = z
  .object({
    beats: z.array(beatSchema).min(1, "beats must contain at least one segment"),
    ...buildObservedMetricFields(BASE_DOMAIN_METRICS.narrative),
    devices: z
      .array(
        z.object({
          type: z.string().min(1),
          timestamp: z.number().min(0),
        }),
      )
      .optional(),
  })
  .passthrough();

const visualEditSoundSchema = z
  .object(buildObservedMetricFields(BASE_DOMAIN_METRICS.visual_edit_sound))
  .passthrough();

const advancedProsodyArcSchema = z.object(buildRichMetricFields(ADVANCED_METRIC_SECTIONS.prosodyArc));

const advancedLanguageTextureSchema = z.object(buildRichMetricFields(ADVANCED_METRIC_SECTIONS.languageTexture));

const advancedNarrativeArcSchema = z.object(buildRichMetricFields(ADVANCED_METRIC_SECTIONS.narrativeArc));

const advancedVisualEditAlignmentSchema = z.object(
  buildRichMetricFields(ADVANCED_METRIC_SECTIONS.visualEditAlignment),
);

const advancedModalityBalanceSchema = z.object(buildRichMetricFields(ADVANCED_METRIC_SECTIONS.modalityBalance));

const advancedCognitiveLoadSchema = z.object(buildRichMetricFields(ADVANCED_METRIC_SECTIONS.cognitiveLoad));

const advancedMetricsSchema: z.ZodType<GeminiAdvancedMetrics> = z.object({
  prosodyArc: advancedProsodyArcSchema,
  languageTexture: advancedLanguageTextureSchema,
  narrativeArc: advancedNarrativeArcSchema,
  visualEditAlignment: advancedVisualEditAlignmentSchema,
  modalityBalance: advancedModalityBalanceSchema,
  cognitiveLoad: advancedCognitiveLoadSchema,
});

const advancedSectionSchemaMap: Record<AdvancedSectionKey, z.ZodTypeAny> = {
  prosodyArc: advancedProsodyArcSchema,
  languageTexture: advancedLanguageTextureSchema,
  narrativeArc: advancedNarrativeArcSchema,
  visualEditAlignment: advancedVisualEditAlignmentSchema,
  modalityBalance: advancedModalityBalanceSchema,
  cognitiveLoad: advancedCognitiveLoadSchema,
};

export const GeminiMultimodalResponseSchema: z.ZodType<GeminiMultimodalResponse> = z
  .object({
    voice: voiceSchema,
    language: languageSchema,
    narrative: narrativeSchema,
    visual_edit_sound: visualEditSoundSchema,
    advanced_metrics: advancedMetricsSchema.optional(),
  })
  .passthrough();

export class InvalidGeminiResponseError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Gemini multimodal response validation failed: ${issues.join("; ")}`);
    this.name = "InvalidGeminiResponseError";
    this.issues = issues;
    Object.setPrototypeOf(this, InvalidGeminiResponseError.prototype);
  }
}

const formatIssues = (error: z.ZodError) =>
  error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);

export const parseGeminiMultimodalJson = (raw: unknown): GeminiMultimodalResponse => {
  const result = GeminiMultimodalResponseSchema.safeParse(raw);
  if (!result.success) {
    throw new InvalidGeminiResponseError(formatIssues(result.error));
  }
  return result.data;
};

export const isGeminiMultimodalResponse = (
  raw: unknown,
): raw is GeminiMultimodalResponse => GeminiMultimodalResponseSchema.safeParse(raw).success;

const buildAdvancedMetricsSchemaForSections = (sections: AdvancedSectionKey[]) =>
  z.object(
    Object.fromEntries(sections.map((section) => [section, advancedSectionSchemaMap[section]])),
  );

const buildAdvancedMetricsResponseSchema = (sections: AdvancedSectionKey[]) =>
  z
    .object({
      advanced_metrics: buildAdvancedMetricsSchemaForSections(sections),
    })
    .passthrough();

export const parseGeminiAdvancedMetricsJson = (
  raw: unknown,
  sections: AdvancedSectionKey[],
): GeminiAdvancedMetricsPartial => {
  const schema = buildAdvancedMetricsResponseSchema(sections);
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new InvalidGeminiResponseError(formatIssues(result.error));
  }
  return result.data.advanced_metrics;
};
