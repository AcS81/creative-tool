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

const coerceObservedMetricInput = (input: unknown): unknown => {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) {
      return { score: 0, value: "unobserved", explanation: "" };
    }
    const lower = trimmed.toLowerCase();
    const isUnobserved = ["unobserved", "n/a", "na", "unknown"].some((token) =>
      lower.includes(token),
    );
    return {
      score: 0,
      value: isUnobserved ? "unobserved" : trimmed,
      explanation: "",
    };
  }
  if (typeof input === "number") {
    return { score: 0, value: input, explanation: "" };
  }
  return input;
};

const observedMetricObjectSchema = z.object({
  score: z.number().min(0).max(100),
  value: z.union([z.string(), z.number(), z.record(z.string(), z.any())]),
  explanation: z.string().optional(),
});

const observedMetricSchema: z.ZodType<GeminiObservedMetric> = z.preprocess(
  coerceObservedMetricInput,
  observedMetricObjectSchema,
);

const richMetricObjectSchema = observedMetricObjectSchema.extend({
  observed: z.boolean().optional(),
  timeline: z.array(timelinePointSchema).optional(),
  spans: z.array(spanSchema).optional(),
  segments: z.array(segmentDeltaSchema).optional(),
  items: z.array(z.record(z.string(), z.any())).optional(),
  proportions: z.record(z.string(), z.number()).optional(),
  counts: z.record(z.string(), z.number()).optional(),
  trend: z.number().optional(),
});

const richMetricSchema: z.ZodType<GeminiRichMetric> = z.preprocess(
  coerceObservedMetricInput,
  richMetricObjectSchema,
);

const coerceSeconds = (input: unknown): unknown => {
  if (typeof input === "number") return input;
  if (typeof input === "string") {
    const match = input.match(/-?\d+(\.\d+)?/);
    if (!match) return input;
    const value = Number(match[0]);
    return Number.isFinite(value) ? value : input;
  }
  return input;
};

const beatSchema: z.ZodType<GeminiBeat> = z
  .object({
    label: z.string().min(1),
    start: z.preprocess(coerceSeconds, z.number().min(0)),
    end: z.preprocess(coerceSeconds, z.number().min(0)),
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
    beats: z.array(beatSchema).optional().default([]),
    ...buildObservedMetricFields(BASE_DOMAIN_METRICS.narrative),
    devices: z
      .array(
        z.object({
          type: z.string().min(1),
          timestamp: z.preprocess(coerceSeconds, z.number().min(0)),
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

const advancedMetricsSchema = z.object({
  prosodyArc: advancedProsodyArcSchema,
  languageTexture: advancedLanguageTextureSchema,
  narrativeArc: advancedNarrativeArcSchema,
  visualEditAlignment: advancedVisualEditAlignmentSchema,
  modalityBalance: advancedModalityBalanceSchema,
  cognitiveLoad: advancedCognitiveLoadSchema,
}) as unknown as z.ZodType<GeminiAdvancedMetrics>;

const advancedSectionSchemaMap: Record<AdvancedSectionKey, z.ZodTypeAny> = {
  prosodyArc: advancedProsodyArcSchema,
  languageTexture: advancedLanguageTextureSchema,
  narrativeArc: advancedNarrativeArcSchema,
  visualEditAlignment: advancedVisualEditAlignmentSchema,
  modalityBalance: advancedModalityBalanceSchema,
  cognitiveLoad: advancedCognitiveLoadSchema,
};

export const GeminiMultimodalResponseSchema = z
  .object({
    voice: voiceSchema,
    language: languageSchema,
    narrative: narrativeSchema,
    visual_edit_sound: visualEditSoundSchema,
    advanced_metrics: advancedMetricsSchema.optional(),
  })
  .passthrough() as unknown as z.ZodType<GeminiMultimodalResponse>;

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

const buildAdvancedMetricsResponseSchemaLenient = (sections: AdvancedSectionKey[]) =>
  z
    .object({
      advanced_metrics: buildAdvancedMetricsSchemaForSections(sections).partial(),
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

export const parseGeminiAdvancedMetricsJsonLenient = (
  raw: unknown,
  sections: AdvancedSectionKey[],
): GeminiAdvancedMetricsPartial => {
  const schema = buildAdvancedMetricsResponseSchemaLenient(sections);
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new InvalidGeminiResponseError(formatIssues(result.error));
  }
  return result.data.advanced_metrics;
};
