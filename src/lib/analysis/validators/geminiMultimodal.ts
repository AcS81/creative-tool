import { z } from "zod";
import type {
  GeminiBeat,
  GeminiMultimodalResponse,
  GeminiObservedMetric,
} from "../types/multimodal";

const observedMetricSchema: z.ZodType<GeminiObservedMetric> = z.object({
  score: z.number().min(0).max(100),
  value: z.string().min(1),
  explanation: z.string().min(1),
});

const beatSchema: z.ZodType<GeminiBeat> = z
  .object({
    label: z.string().min(1),
    start: z.number().min(0),
    end: z.number().min(0),
  })
  .refine((val) => val.end >= val.start, {
    message: "end must be greater than or equal to start",
    path: ["end"],
  });

const voiceSchema = z
  .object({
    speaking_rate: observedMetricSchema,
    filler_rate: observedMetricSchema,
    pauses: observedMetricSchema,
    loudness_range: observedMetricSchema,
    pitch_variation: observedMetricSchema,
  })
  .passthrough();

const languageSchema = z
  .object({
    concreteness: observedMetricSchema,
    metaphor_density: observedMetricSchema,
    references: observedMetricSchema,
    humor: observedMetricSchema,
    teaching_vs_riffing: observedMetricSchema,
  })
  .passthrough();

const narrativeSchema = z
  .object({
    beats: z.array(beatSchema).min(1, "beats must contain at least one segment"),
    mini_arc_density: observedMetricSchema,
    foreshadow_callbacks: observedMetricSchema,
    transition_clarity: observedMetricSchema,
  })
  .passthrough();

const visualEditSoundSchema = z
  .object({
    environment_stability: observedMetricSchema,
    talking_vs_broll_vs_graphics: observedMetricSchema,
    cut_rate: observedMetricSchema,
    pattern_interrupts: observedMetricSchema,
    broll_coverage: observedMetricSchema,
    music_changes: observedMetricSchema,
    sfx_density: observedMetricSchema,
    silence_for_emphasis: observedMetricSchema,
  })
  .passthrough();

export const GeminiMultimodalResponseSchema: z.ZodType<GeminiMultimodalResponse> = z
  .object({
    voice: voiceSchema,
    language: languageSchema,
    narrative: narrativeSchema,
    visual_edit_sound: visualEditSoundSchema,
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
