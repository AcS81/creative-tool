import { z } from "zod";
import type {
  GeminiAdvancedMetrics,
  GeminiBeat,
  GeminiMultimodalResponse,
  GeminiObservedMetric,
  GeminiRichMetric,
} from "../types/multimodal";

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
    music_coverage: observedMetricSchema,
    music_changes: observedMetricSchema,
    sfx_density: observedMetricSchema,
    silence_for_emphasis: observedMetricSchema,
  })
  .passthrough();

const advancedProsodyArcSchema = z.object({
  paceMeanWpm: richMetricSchema,
  paceVariabilityPct: richMetricSchema,
  withinSegmentPaceChangePct: richMetricSchema,
  emphasisAlignmentScore: richMetricSchema,
  energyDriftDbPerMin: richMetricSchema,
});

const advancedLanguageTextureSchema = z.object({
  analogyExampleDefinitionRatio: richMetricSchema,
  sentenceCompressionRatio: richMetricSchema,
  humorTimingScore: richMetricSchema,
  referenceDensityPerMin: richMetricSchema,
  questionRate: richMetricSchema,
});

const advancedNarrativeArcSchema = z.object({
  timeToHookSeconds: richMetricSchema,
  hookStrengthScore: richMetricSchema,
  segmentCohesionDrift: richMetricSchema,
  openLoopsUnresolvedRatio: richMetricSchema,
  endingResolutionScore: richMetricSchema,
});

const advancedVisualEditAlignmentSchema = z.object({
  visualEntropy: richMetricSchema,
  cutRateRefinement: richMetricSchema,
  silenceForEmphasisFidelity: richMetricSchema,
  audioVisualEmphasisAlignment: richMetricSchema,
  beatsVsEditsAlignment: richMetricSchema,
  prosodyVsSemanticImportanceAlignment: richMetricSchema,
});

const advancedModalityBalanceSchema = z.object({
  redundancyVsComplementarity: richMetricSchema,
  modalityOverReliance: richMetricSchema,
});

const advancedCognitiveLoadSchema = z.object({
  loadPerSecond: richMetricSchema,
  loadHighlights: richMetricSchema,
});

const advancedSecondOrderSchema = z.object({
  alignmentScore: richMetricSchema,
  driftScore: richMetricSchema,
  decayScore: richMetricSchema,
  balanceScore: richMetricSchema,
  timingScore: richMetricSchema,
});

const advancedMetricsSchema: z.ZodType<GeminiAdvancedMetrics> = z.object({
  prosodyArc: advancedProsodyArcSchema,
  languageTexture: advancedLanguageTextureSchema,
  narrativeArc: advancedNarrativeArcSchema,
  visualEditAlignment: advancedVisualEditAlignmentSchema,
  modalityBalance: advancedModalityBalanceSchema,
  cognitiveLoad: advancedCognitiveLoadSchema,
  secondOrder: advancedSecondOrderSchema,
});

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
