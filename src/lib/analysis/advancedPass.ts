import { z } from "zod";
import type { AppConfig, AdvancedResponseFormat, AdvancedSchemaStrategy } from "../config";
import {
  callGeminiMultimodalJson,
  GeminiApiError,
  type GeminiMultimodalErrorCode,
  type GeminiMultimodalResult,
} from "../gemini/client";
import type { Chapter } from "./types/skeleton";
import type { VideoSkeleton } from "./types/skeleton";
import type { SegmentPlan, AdvancedAnalysisPlan } from "./advancedPlanner";
import type {
  AdvancedSegmentType,
  SegmentAdvancedMetrics,
  RichMetric,
  AdvancedTimelinePoint,
} from "./types/advancedMetrics";
import { buildDefaultAdvancedMetrics } from "./fingerprint/defaults";

export type SegmentAdvancedInput = {
  youtubeUrl: string;
  segment: SegmentPlan;
  skeleton: VideoSkeleton;
  segmentId?: string;
  config?: AppConfig;
};

export type AdvancedPassInput = {
  youtubeUrl: string;
  skeleton: VideoSkeleton;
  config?: AppConfig;
};

export type AdvancedPassConfig = {
  maxSegments?: number;
  maxCostUsd?: number;
  maxDurationMs?: number;
  estimatedCostPerSegmentUsd?: number;
};

export type SegmentCostEstimate = {
  segmentId: string;
  segmentType: AdvancedSegmentType;
  durationSeconds: number;
  estimatedCostUsd: number;
  status: "completed" | "failed" | "skipped_cost" | "skipped_duration";
};

export type AdvancedPassDiagnostics = {
  segmentsPlanned: number;
  segmentsCompleted: number;
  segmentsFailed: number;
  totalDurationMs: number;
  estimatedCostUsd: number;
  segmentEstimates?: SegmentCostEstimate[];
};

export type AdvancedPassResult = {
  segments: SegmentAdvancedMetrics[];
  diagnostics: AdvancedPassDiagnostics;
};

const DEFAULT_SEGMENT_TIMEOUT_MS = 60_000;
const DEFAULT_ESTIMATED_SEGMENT_COST_USD = 0.03;
const DEFAULT_MAX_SEGMENTS = 5;
const DEFAULT_MAX_COST_USD = 0.25;
const DEFAULT_MAX_DURATION_MS = 180_000;
const DEFAULT_MAX_TIMELINE_POINTS = 25;
const DEFAULT_ADVANCED_RESPONSE_FORMAT: AdvancedResponseFormat = "full";
const DEFAULT_ADVANCED_SCHEMA_STRATEGY: AdvancedSchemaStrategy = "inherit";
const TARGET_SEGMENT_COST_MIN_USD = 0.02;
const TARGET_SEGMENT_COST_MAX_USD = 0.05;
const TARGET_TOTAL_COST_MAX_USD = 0.25;

const buildFallbackSegmentMetrics = (
  segment: SegmentPlan,
  segmentId: string,
  error?: string,
): SegmentAdvancedMetrics => {
  const defaults = buildDefaultAdvancedMetrics();
  return {
    segmentId,
    chapterId: segment.chapterId,
    startSeconds: segment.startSeconds,
    endSeconds: segment.endSeconds,
    segmentType: segment.segmentType,
    prosodyArc: defaults.prosodyArc,
    languageTexture: defaults.languageTexture,
    narrativeArc: defaults.narrativeArc,
    visualEditAlignment: defaults.visualEditAlignment,
    diagnostics: {
      fallback: true,
      error,
    },
  };
};

const systemInstruction = [
  "You are a video metrics analyzer.",
  "Analyze only the specified time range.",
  "Return strict JSON only.",
].join("\n");

const timelinePointSchema = z.object({
  timeSeconds: z.number().min(0),
  value: z.number(),
  label: z.string().optional(),
});

const spanSchema = z
  .object({
    startSeconds: z.number().min(0),
    endSeconds: z.number().min(0),
    value: z.number().optional(),
    label: z.string().optional(),
    alignedBeat: z.string().optional(),
    alignedPunchline: z.boolean().optional(),
  })
  .passthrough();

const segmentDeltaSchema = z
  .object({
    startSeconds: z.number().min(0),
    endSeconds: z.number().min(0),
    deltaPct: z.number().optional(),
    label: z.string().optional(),
  })
  .passthrough();

const richMetricSchema = z
  .object({
    score: z.number().min(0).max(100),
    value: z.preprocess((value) => (typeof value === "number" ? String(value) : value), z.string()),
    observed: z.boolean(),
    timeline: z.array(timelinePointSchema).optional(),
    spans: z.array(spanSchema).optional(),
    segments: z.array(segmentDeltaSchema).optional(),
    items: z.array(z.record(z.string(), z.unknown())).optional(),
    counts: z.record(z.string(), z.number()).optional(),
    proportions: z.record(z.string(), z.number()).optional(),
    trend: z.number().optional(),
  })
  .passthrough();

const richMetricJsonSchema = {
  type: "object",
  properties: {
    score: { type: "number" },
    value: { type: "string" },
    observed: { type: "boolean" },
    timeline: {
      type: "array",
      items: {
        type: "object",
        properties: {
          timeSeconds: { type: "number" },
          value: { type: "number" },
          label: { type: "string" },
        },
        required: ["timeSeconds", "value"],
      },
    },
    spans: { type: "array", items: { type: "object" } },
    segments: { type: "array", items: { type: "object" } },
    items: { type: "array", items: { type: "object" } },
    counts: { type: "object" },
    proportions: { type: "object" },
    trend: { type: "number" },
  },
  required: ["score", "value", "observed"],
};

const richMetricWithTimelineJsonSchema = {
  type: "object",
  properties: {
    score: { type: "number" },
    value: { type: "string" },
    observed: { type: "boolean" },
    timeline: {
      type: "array",
      items: {
        type: "object",
        properties: {
          timeSeconds: { type: "number" },
          value: { type: "number" },
          label: { type: "string" },
        },
        required: ["timeSeconds", "value"],
      },
    },
  },
  required: ["score", "value", "observed", "timeline"],
};

const minimalMetricJsonSchema = {
  type: "object",
};

const hookJsonSchema = {
  type: "object",
  properties: {
    hookAnalysis: {
      type: "object",
      properties: {
        timeToHook: richMetricJsonSchema,
        hookStrength: richMetricJsonSchema,
        paceVariability: richMetricWithTimelineJsonSchema,
        energyLevel: richMetricWithTimelineJsonSchema,
      },
      required: ["timeToHook", "hookStrength", "paceVariability", "energyLevel"],
    },
  },
  required: ["hookAnalysis"],
};

const hookJsonSchemaFallback = {
  type: "object",
  properties: {
    hookAnalysis: {
      type: "object",
      properties: {
        timeToHook: minimalMetricJsonSchema,
        hookStrength: minimalMetricJsonSchema,
        paceVariability: minimalMetricJsonSchema,
        energyLevel: minimalMetricJsonSchema,
      },
      required: ["timeToHook", "hookStrength", "paceVariability", "energyLevel"],
    },
  },
  required: ["hookAnalysis"],
};

const prosodyLanguageJsonSchema = {
  type: "object",
  properties: {
    prosody: {
      type: "object",
      properties: {
        paceVariability: richMetricJsonSchema,
        paceWithinSegment: richMetricJsonSchema,
        emphasisAlignment: richMetricJsonSchema,
        energyDrift: richMetricJsonSchema,
      },
      required: ["paceVariability", "paceWithinSegment", "emphasisAlignment", "energyDrift"],
    },
    languageTexture: {
      type: "object",
      properties: {
        sentenceCompression: richMetricJsonSchema,
        humorTiming: richMetricJsonSchema,
        audienceAddress: richMetricJsonSchema,
        questionRate: richMetricJsonSchema,
      },
      required: ["sentenceCompression", "humorTiming", "audienceAddress", "questionRate"],
    },
  },
  required: ["prosody", "languageTexture"],
};

const prosodyLanguageJsonSchemaFallback = {
  type: "object",
  properties: {
    prosody: {
      type: "object",
      properties: {
        paceVariability: minimalMetricJsonSchema,
        paceWithinSegment: minimalMetricJsonSchema,
        emphasisAlignment: minimalMetricJsonSchema,
        energyDrift: minimalMetricJsonSchema,
      },
      required: ["paceVariability", "paceWithinSegment", "emphasisAlignment", "energyDrift"],
    },
    languageTexture: {
      type: "object",
      properties: {
        sentenceCompression: minimalMetricJsonSchema,
        humorTiming: minimalMetricJsonSchema,
        audienceAddress: minimalMetricJsonSchema,
        questionRate: minimalMetricJsonSchema,
      },
      required: ["sentenceCompression", "humorTiming", "audienceAddress", "questionRate"],
    },
  },
  required: ["prosody", "languageTexture"],
};

const visualEditJsonSchema = {
  type: "object",
  properties: {
    visualDynamics: {
      type: "object",
      properties: {
        visualEntropy: richMetricJsonSchema,
        cutRefinement: richMetricJsonSchema,
        silenceSpans: richMetricJsonSchema,
        beatEditAlignment: richMetricJsonSchema,
      },
      required: ["visualEntropy", "cutRefinement", "silenceSpans", "beatEditAlignment"],
    },
  },
  required: ["visualDynamics"],
};

const visualEditJsonSchemaFallback = {
  type: "object",
  properties: {
    visualDynamics: {
      type: "object",
      properties: {
        visualEntropy: minimalMetricJsonSchema,
        cutRefinement: minimalMetricJsonSchema,
        silenceSpans: minimalMetricJsonSchema,
        beatEditAlignment: minimalMetricJsonSchema,
      },
      required: ["visualEntropy", "cutRefinement", "silenceSpans", "beatEditAlignment"],
    },
  },
  required: ["visualDynamics"],
};

const narrativeArcJsonSchema = {
  type: "object",
  properties: {
    narrativeArc: {
      type: "object",
      properties: {
        segmentCohesion: richMetricJsonSchema,
        openLoops: richMetricJsonSchema,
        transitionClarity: richMetricJsonSchema,
      },
      required: ["segmentCohesion", "openLoops"],
    },
  },
  required: ["narrativeArc"],
};

const narrativeArcJsonSchemaFallback = {
  type: "object",
  properties: {
    narrativeArc: {
      type: "object",
      properties: {
        segmentCohesion: minimalMetricJsonSchema,
        openLoops: minimalMetricJsonSchema,
        transitionClarity: minimalMetricJsonSchema,
      },
      required: ["segmentCohesion", "openLoops"],
    },
  },
  required: ["narrativeArc"],
};

const endingJsonSchema = {
  type: "object",
  properties: {
    endingAnalysis: {
      type: "object",
      properties: {
        endingResolution: richMetricJsonSchema,
        openLoopsResolved: richMetricJsonSchema,
        ctaClarity: richMetricJsonSchema,
        emotionalLanding: richMetricJsonSchema,
      },
      required: ["endingResolution", "openLoopsResolved"],
    },
  },
  required: ["endingAnalysis"],
};

const endingJsonSchemaFallback = {
  type: "object",
  properties: {
    endingAnalysis: {
      type: "object",
      properties: {
        endingResolution: minimalMetricJsonSchema,
        openLoopsResolved: minimalMetricJsonSchema,
        ctaClarity: minimalMetricJsonSchema,
        emotionalLanding: minimalMetricJsonSchema,
      },
      required: ["endingResolution", "openLoopsResolved"],
    },
  },
  required: ["endingAnalysis"],
};

const compactResponseJsonSchema = {
  type: "object",
  properties: {
    scores: { type: "object" },
    anchors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          t: { type: "number" },
          v: { type: "number" },
          metric: { type: "string" },
          type: { type: "string" },
          note: { type: "string" },
        },
        required: ["t", "v"],
      },
    },
    flags: { type: "array", items: { type: "string" } },
  },
  required: ["scores"],
};

const compactResponseJsonSchemaFallback = {
  type: "object",
  properties: {
    scores: { type: "object" },
  },
};

const segmentSchemas: Record<AdvancedSegmentType, unknown> = {
  hook: hookJsonSchema,
  prosody_language: prosodyLanguageJsonSchema,
  visual_edit: visualEditJsonSchema,
  narrative_arc: narrativeArcJsonSchema,
  ending: endingJsonSchema,
};

const segmentSchemaFallbacks: Record<AdvancedSegmentType, unknown> = {
  hook: hookJsonSchemaFallback,
  prosody_language: prosodyLanguageJsonSchemaFallback,
  visual_edit: visualEditJsonSchemaFallback,
  narrative_arc: narrativeArcJsonSchemaFallback,
  ending: endingJsonSchemaFallback,
};

const resolveSegmentSchema = (segmentType: AdvancedSegmentType, responseFormat: AdvancedResponseFormat) =>
  responseFormat === "compact" ? compactResponseJsonSchema : segmentSchemas[segmentType];

const resolveSegmentSchemaFallback = (
  segmentType: AdvancedSegmentType,
  responseFormat: AdvancedResponseFormat,
) => (responseFormat === "compact" ? compactResponseJsonSchemaFallback : segmentSchemaFallbacks[segmentType]);

const buildUnobservedMetric = (): RichMetric => ({
  score: 0,
  value: "unobserved",
  observed: false,
  timeline: [],
  spans: [],
  segments: [],
  items: [],
});

const normalizeTimelineArray = (raw: unknown): AdvancedTimelinePoint[] | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const points: AdvancedTimelinePoint[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const time =
      typeof record.timeSeconds === "number"
        ? record.timeSeconds
        : typeof record.time === "number"
          ? record.time
          : typeof record.timestamp === "number"
            ? record.timestamp
            : undefined;
    const value = typeof record.value === "number" ? record.value : undefined;
    if (time === undefined || value === undefined) continue;
    const label = typeof record.label === "string" ? record.label : undefined;
    points.push({ timeSeconds: time, value, label });
  }
  return points.length ? points : undefined;
};

const normalizeMetricPayload = (raw: unknown): unknown => {
  if (!raw || typeof raw !== "object") return raw;
  const record = { ...(raw as Record<string, unknown>) };
  const timelineValue = record.timeline ?? record.timelinePoints ?? record.timeline_points ?? record.points ?? record.samples;
  const normalized = normalizeTimelineArray(timelineValue);
  if (normalized) {
    record.timeline = normalized;
  }
  return record;
};

const resolveMetricField = (source: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!source) return undefined;
  for (const key of keys) {
    if (key in source) return source[key];
  }
  return undefined;
};

const parseMetric = (raw: unknown): RichMetric => {
  const parsed = richMetricSchema.safeParse(normalizeMetricPayload(raw));
  if (!parsed.success) {
    return buildUnobservedMetric();
  }
  return parsed.data;
};

const resolveSection = <T extends Record<string, unknown>>(raw: Record<string, unknown>, keys: string[]): T | null => {
  for (const key of keys) {
    if (raw && typeof raw[key] === "object" && raw[key] !== null) {
      return raw[key] as T;
    }
  }
  return null;
};

const parseNumericValue = (value: string): number | undefined => {
  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : undefined;
};

const clampValue = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const ensureMetricTimeline = (
  metric: RichMetric,
  segmentDuration: number,
  force = false,
): RichMetric => {
  if (metric.timeline && metric.timeline.length > 0) return metric;
  const valueText = typeof metric.value === "string" ? metric.value.trim() : "";
  const numeric = parseNumericValue(valueText) ?? (Number.isFinite(metric.score) ? metric.score : undefined);
  const shouldFill =
    force ||
    metric.observed === true ||
    (valueText !== "" && valueText.toLowerCase() !== "unobserved") ||
    (numeric !== undefined && numeric > 0);
  if (!shouldFill || numeric === undefined) return metric;
  const delta = Math.max(1, Math.min(10, numeric * 0.1));
  const start = clampValue(numeric - delta);
  const end = clampValue(numeric + delta);
  const endTime = Math.max(1, Math.round(segmentDuration));
  return {
    ...metric,
    timeline: [
      { timeSeconds: 0, value: start },
      { timeSeconds: endTime, value: end },
    ],
  };
};

const ensureHookTimelines = (segment: SegmentAdvancedMetrics, segmentDuration: number): SegmentAdvancedMetrics => {
  if (segment.segmentType !== "hook" || !segment.prosodyArc) return segment;
  return {
    ...segment,
    prosodyArc: {
      ...segment.prosodyArc,
      paceVariabilityPct: segment.prosodyArc.paceVariabilityPct
        ? ensureMetricTimeline(segment.prosodyArc.paceVariabilityPct, segmentDuration, true)
        : segment.prosodyArc.paceVariabilityPct,
      energyDriftDbPerMin: segment.prosodyArc.energyDriftDbPerMin
        ? ensureMetricTimeline(segment.prosodyArc.energyDriftDbPerMin, segmentDuration, true)
        : segment.prosodyArc.energyDriftDbPerMin,
    },
  };
};

const maxTimelinePoints = (segmentDuration: number, maxPointsLimit = DEFAULT_MAX_TIMELINE_POINTS): number => {
  const maxPoints = Math.max(1, maxPointsLimit);
  if (segmentDuration <= 30) return Math.min(10, maxPoints);
  if (segmentDuration <= 60) return Math.min(15, maxPoints);
  if (segmentDuration <= 120) return Math.min(20, maxPoints);
  return Math.min(25, maxPoints);
};

const capTimeline = (
  timeline: AdvancedTimelinePoint[] = [],
  segmentDuration: number,
  maxPointsLimit?: number,
): AdvancedTimelinePoint[] => {
  if (!Array.isArray(timeline) || timeline.length === 0) return [];
  const maxPoints = maxTimelinePoints(segmentDuration, maxPointsLimit);
  if (timeline.length <= maxPoints) return timeline;

  const sorted = [...timeline].sort((a, b) => a.timeSeconds - b.timeSeconds);
  const lastIndex = sorted.length - 1;
  const selected = new Set<number>([0, lastIndex]);
  const values = sorted.map((point) => point.value);

  for (let i = 1; i < lastIndex; i += 1) {
    const prev = values[i - 1];
    const current = values[i];
    const next = values[i + 1];
    const isPeak = current >= prev && current >= next;
    const isValley = current <= prev && current <= next;
    if (isPeak || isValley) {
      selected.add(i);
    }
  }

  const byProminence = (index: number) => {
    const prev = values[Math.max(0, index - 1)];
    const next = values[Math.min(lastIndex, index + 1)];
    const current = values[index];
    return Math.max(Math.abs(current - prev), Math.abs(current - next));
  };

  if (selected.size > maxPoints) {
    const keep: number[] = [0, lastIndex];
    const remaining = [...selected].filter((idx) => idx !== 0 && idx !== lastIndex);
    remaining.sort((a, b) => byProminence(b) - byProminence(a));
    for (const idx of remaining) {
      if (keep.length >= maxPoints) break;
      keep.push(idx);
    }
    return keep
      .sort((a, b) => a - b)
      .map((idx) => sorted[idx]);
  }

  if (selected.size < maxPoints) {
    const remaining = sorted
      .map((_, idx) => idx)
      .filter((idx) => !selected.has(idx));
    const needed = maxPoints - selected.size;
    if (remaining.length > 0 && needed > 0) {
      const step = Math.max(1, Math.floor(remaining.length / needed));
      for (let i = 0; i < remaining.length && selected.size < maxPoints; i += step) {
        selected.add(remaining[i]);
      }
    }
  }

  return [...selected]
    .sort((a, b) => a - b)
    .map((idx) => sorted[idx]);
};

const capMetricTimeline = (metric: RichMetric, segmentDuration: number, maxPointsLimit?: number): RichMetric => {
  if (!metric.timeline || metric.timeline.length === 0) return metric;
  return {
    ...metric,
    timeline: capTimeline(metric.timeline, segmentDuration, maxPointsLimit),
  };
};

const capSegmentTimelines = (
  segment: SegmentAdvancedMetrics,
  segmentDuration: number,
  maxPointsLimit?: number,
): SegmentAdvancedMetrics => {
  const applyToSection = <T extends Record<string, RichMetric> | undefined>(section?: T) => {
    if (!section) return section;
    const cappedEntries = Object.entries(section).map(([key, metric]) => [
      key,
      capMetricTimeline(metric, segmentDuration, maxPointsLimit),
    ]);
    return Object.fromEntries(cappedEntries) as T;
  };

  return {
    ...segment,
    prosodyArc: applyToSection(segment.prosodyArc),
    languageTexture: applyToSection(segment.languageTexture),
    narrativeArc: applyToSection(segment.narrativeArc),
    visualEditAlignment: applyToSection(segment.visualEditAlignment),
  };
};

const buildSegmentId = (segment: SegmentPlan) =>
  `${segment.segmentType}_${segment.chapterId}_${segment.startSeconds}_${segment.endSeconds}`;

const resolveChapter = (skeleton: VideoSkeleton, segment: SegmentPlan): Chapter | undefined =>
  skeleton.chapters.find((chapter) => chapter.id === segment.chapterId);

const buildFullPrompt = (input: {
  segmentType: AdvancedSegmentType;
  segment: SegmentPlan;
  chapter?: Chapter;
  skeleton: VideoSkeleton;
  maxTimelinePoints: number;
}): string => {
  const { segment, skeleton, chapter, maxTimelinePoints } = input;
  const chapterTitle = chapter?.title ?? "Unknown chapter";
  const chapterType = chapter?.chapterType ?? "body";
  const topicSummary = skeleton.topicSummary;
  const videoType = skeleton.videoType;
  const startSeconds = segment.startSeconds;
  const endSeconds = segment.endSeconds;

  switch (input.segmentType) {
    case "hook":
      return [
        "Analyze the HOOK section of this video.",
        `VIDEO URL: {{youtubeUrl}}`,
        `VIDEO TYPE: ${videoType}`,
        `VIDEO CONTEXT: "${topicSummary}"`,
        `ANALYZE: ${startSeconds}s - ${endSeconds}s`,
        "",
        `Return JSON with hookAnalysis and timelines (max ${maxTimelinePoints} points):`,
        "{",
        '  "hookAnalysis": {',
        '    "timeToHook": { "score": number, "value": "X seconds", "observed": boolean, "details": "..." },',
        '    "hookStrength": { "score": number, "value": "weak|moderate|strong", "observed": boolean, "devices": [] },',
        '    "paceVariability": { "score": number, "value": "X% variation", "observed": boolean, "timeline": [] },',
        '    "energyLevel": { "score": number, "value": "description", "observed": boolean, "timeline": [] }',
        "  }",
        "}",
        "Rules:",
        "- timeToHook.value must be numeric seconds (e.g., \"8 seconds\").",
        "- Choose the earliest clear hook/promise; if none, set observed:false.",
        "- paceVariability and energyLevel must include timelines (at least 2 points).",
        "- Do not omit any fields; return all four metrics even if observed:false.",
        "JSON only.",
      ].join("\n");
    case "prosody_language":
      return [
        "Analyze this segment for prosody and language texture.",
        `VIDEO URL: {{youtubeUrl}}`,
        `VIDEO TYPE: ${videoType}`,
        `VIDEO CONTEXT: "${topicSummary}"`,
        `SEGMENT: "${chapterTitle}" (${startSeconds}s - ${endSeconds}s)`,
        "",
        `Return JSON with prosody + languageTexture (max ${maxTimelinePoints} points per timeline):`,
        "{",
        '  "prosody": {',
        '    "paceVariability": { "score": number, "value": "X% CoV", "observed": boolean, "timeline": [] },',
        '    "paceWithinSegment": { "score": number, "value": "accelerating|decelerating|stable|erratic", "observed": boolean },',
        '    "emphasisAlignment": { "score": number, "value": "description", "observed": boolean, "items": [] },',
        '    "energyDrift": { "score": number, "value": "X dB/min", "observed": boolean, "timeline": [] }',
        "  },",
        '  "languageTexture": {',
        '    "sentenceCompression": { "score": number, "value": "X words per idea", "observed": boolean },',
        '    "humorTiming": { "score": number, "value": "description", "observed": boolean, "items": [] },',
        '    "audienceAddress": { "score": number, "value": "X per min", "observed": boolean, "timeline": [] },',
        '    "questionRate": { "score": number, "value": "X per min", "observed": boolean }',
        "  }",
        "}",
        "JSON only.",
      ].join("\n");
    case "visual_edit":
      return [
        "Analyze this segment for visual dynamics and editing patterns.",
        `VIDEO URL: {{youtubeUrl}}`,
        `VIDEO TYPE: ${videoType}`,
        `VIDEO CONTEXT: "${topicSummary}"`,
        `SEGMENT: "${chapterTitle}" (${startSeconds}s - ${endSeconds}s)`,
        "",
        `Return JSON with visualDynamics (max ${maxTimelinePoints} points):`,
        "{",
        '  "visualDynamics": {',
        '    "visualEntropy": { "score": number, "value": "low|moderate|high|chaotic", "observed": boolean, "timeline": [] },',
        '    "cutRefinement": { "score": number, "value": "description", "observed": boolean },',
        '    "silenceSpans": { "score": number, "value": "X intentional pauses", "observed": boolean, "spans": [] },',
        '    "beatEditAlignment": { "score": number, "value": "description", "observed": boolean, "items": [] }',
        "  }",
        "}",
        "JSON only.",
      ].join("\n");
    case "narrative_arc":
      return [
        "Analyze narrative arc for this segment.",
        `VIDEO URL: {{youtubeUrl}}`,
        `VIDEO TYPE: ${videoType}`,
        `VIDEO CONTEXT: "${topicSummary}"`,
        `SEGMENT: "${chapterTitle}" (${startSeconds}s - ${endSeconds}s)`,
        `CHAPTER TYPE: ${chapterType}`,
        "",
        "Return JSON with narrativeArc:",
        "{",
        '  "narrativeArc": {',
        '    "segmentCohesion": { "score": number, "value": "description", "observed": boolean, "driftPoints": [] },',
        '    "openLoops": { "score": number, "value": "X open, Y resolved", "observed": boolean, "items": [] },',
        '    "transitionClarity": { "score": number, "value": "description", "observed": boolean }',
        "  }",
        "}",
        "JSON only.",
      ].join("\n");
    case "ending":
      return [
        "Analyze the ENDING of this video.",
        `VIDEO URL: {{youtubeUrl}}`,
        `VIDEO TYPE: ${videoType}`,
        `VIDEO CONTEXT: "${topicSummary}"`,
        `ANALYZE: ${startSeconds}s - ${endSeconds}s`,
        "OPEN LOOPS FROM EARLIER: []",
        "",
        "Return JSON with endingAnalysis:",
        "{",
        '  "endingAnalysis": {',
        '    "endingResolution": { "score": number, "value": "description", "observed": boolean },',
        '    "openLoopsResolved": { "score": number, "value": "X of Y resolved", "observed": boolean },',
        '    "ctaClarity": { "score": number, "value": "description", "observed": boolean },',
        '    "emotionalLanding": { "score": number, "value": "description", "observed": boolean }',
        "  }",
        "}",
        "JSON only.",
      ].join("\n");
  }
};

const buildCompactPrompt = (input: {
  segmentType: AdvancedSegmentType;
  segment: SegmentPlan;
  chapter?: Chapter;
  skeleton: VideoSkeleton;
  maxTimelinePoints: number;
}): string => {
  const { segment, skeleton, chapter } = input;
  const chapterTitle = chapter?.title ?? "Unknown chapter";
  const topicSummary = skeleton.topicSummary;
  const videoType = skeleton.videoType;
  const startSeconds = segment.startSeconds;
  const endSeconds = segment.endSeconds;
  const anchorLimit = Math.max(3, Math.min(6, Math.round(input.maxTimelinePoints / 4)));

  switch (input.segmentType) {
    case "hook":
      return [
        "Analyze the HOOK section of this video.",
        `VIDEO URL: {{youtubeUrl}}`,
        `VIDEO TYPE: ${videoType}`,
        `VIDEO CONTEXT: "${topicSummary}"`,
        `ANALYZE: ${startSeconds}s - ${endSeconds}s`,
        "",
        "Return compact JSON:",
        "{",
        '  "scores": {',
        '    "timeToHook": number (seconds),',
        '    "hookStrength": number (0-100),',
        '    "paceVar": number (0-100),',
        '    "energy": number (0-100)',
        "  },",
        '  "anchors": [',
        `    { "t": number, "v": number, "metric": "pace|energy", "type": "start|peak|end" }`,
        "  ],",
        '  "flags": ["curiosity_gap", "bold_claim", "question", "surprising_fact"]',
        "}",
        "Rules:",
        `- Use <= ${anchorLimit} anchors per metric.`,
        "- timeToHook is seconds from segment start.",
        "- Omit anchors if not observable.",
        "JSON only.",
      ].join("\n");
    case "prosody_language":
      return [
        "Analyze this segment for prosody and language texture.",
        `VIDEO URL: {{youtubeUrl}}`,
        `VIDEO TYPE: ${videoType}`,
        `VIDEO CONTEXT: "${topicSummary}"`,
        `SEGMENT: "${chapterTitle}" (${startSeconds}s - ${endSeconds}s)`,
        "",
        "Return compact JSON:",
        "{",
        '  "scores": {',
        '    "paceVar": number (0-100),',
        '    "paceChange": number (0-100),',
        '    "emphasis": number (0-100),',
        '    "energy": number (0-100),',
        '    "compression": number (0-100),',
        '    "humor": number (0-100),',
        '    "address": number (0-100),',
        '    "questionRate": number (0-100)',
        "  },",
        '  "anchors": [',
        `    { "t": number, "v": number, "metric": "pace|energy", "type": "start|peak|end" }`,
        "  ],",
        '  "flags": ["fast_pace", "slow_pace", "high_energy", "low_energy"]',
        "}",
        "Rules:",
        `- Use <= ${anchorLimit} anchors per metric.`,
        "- Omit anchors if not observable.",
        "JSON only.",
      ].join("\n");
    case "visual_edit":
      return [
        "Analyze this segment for visual dynamics and editing patterns.",
        `VIDEO URL: {{youtubeUrl}}`,
        `VIDEO TYPE: ${videoType}`,
        `VIDEO CONTEXT: "${topicSummary}"`,
        `SEGMENT: "${chapterTitle}" (${startSeconds}s - ${endSeconds}s)`,
        "",
        "Return compact JSON:",
        "{",
        '  "scores": {',
        '    "visualEntropy": number (0-100),',
        '    "cutRefine": number (0-100),',
        '    "silenceFidelity": number (0-100),',
        '    "beatEditAlign": number (0-100)',
        "  },",
        '  "anchors": [',
        `    { "t": number, "v": number, "metric": "visualEntropy", "type": "start|peak|end" }`,
        "  ],",
        '  "flags": ["rapid_cuts", "slow_cuts", "high_motion"]',
        "}",
        "Rules:",
        `- Use <= ${anchorLimit} anchors for visualEntropy.`,
        "- Omit anchors if not observable.",
        "JSON only.",
      ].join("\n");
    case "narrative_arc":
      return [
        "Analyze narrative arc for this segment.",
        `VIDEO URL: {{youtubeUrl}}`,
        `VIDEO TYPE: ${videoType}`,
        `VIDEO CONTEXT: "${topicSummary}"`,
        `SEGMENT: "${chapterTitle}" (${startSeconds}s - ${endSeconds}s)`,
        "",
        "Return compact JSON:",
        "{",
        '  "scores": {',
        '    "cohesion": number (0-100),',
        '    "openLoops": number (0-100)',
        "  },",
        '  "flags": ["clear_throughline", "wandering", "open_loop"]',
        "}",
        "JSON only.",
      ].join("\n");
    case "ending":
      return [
        "Analyze the ENDING of this video.",
        `VIDEO URL: {{youtubeUrl}}`,
        `VIDEO TYPE: ${videoType}`,
        `VIDEO CONTEXT: "${topicSummary}"`,
        `ANALYZE: ${startSeconds}s - ${endSeconds}s`,
        "",
        "Return compact JSON:",
        "{",
        '  "scores": {',
        '    "endingResolution": number (0-100),',
        '    "openLoopsResolved": number (0-100),',
        '    "ctaClarity": number (0-100),',
        '    "emotionalLanding": number (0-100)',
        "  },",
        '  "flags": ["clear_cta", "soft_cta", "strong_finish"]',
        "}",
        "JSON only.",
      ].join("\n");
  }
};

const buildPrompt = (input: {
  segmentType: AdvancedSegmentType;
  segment: SegmentPlan;
  chapter?: Chapter;
  skeleton: VideoSkeleton;
  maxTimelinePoints: number;
  responseFormat: AdvancedResponseFormat;
}): string =>
  input.responseFormat === "compact"
    ? buildCompactPrompt(input)
    : buildFullPrompt(input);

const resolveAdvancedResponseFormat = (config?: AppConfig): AdvancedResponseFormat =>
  config?.advancedResponseFormat ?? DEFAULT_ADVANCED_RESPONSE_FORMAT;

const resolveAdvancedSchemaStrategy = (config?: AppConfig): AdvancedSchemaStrategy =>
  config?.advancedSchemaStrategy ?? DEFAULT_ADVANCED_SCHEMA_STRATEGY;

const resolveSchemaOptions = (
  config: AppConfig | undefined,
  schema: unknown,
  fallback?: unknown,
): {
  jsonSchema?: unknown;
  jsonSchemaFallback?: unknown;
  forceResponseSchema?: boolean;
} => {
  const strategy = resolveAdvancedSchemaStrategy(config);
  if (strategy === "optional") {
    return {
      jsonSchema: undefined,
      jsonSchemaFallback: undefined,
    };
  }
  if (strategy === "strict") {
    return {
      jsonSchema: schema,
      jsonSchemaFallback: fallback,
      forceResponseSchema: true,
    };
  }
  return {
    jsonSchema: schema,
    jsonSchemaFallback: fallback,
  };
};

const resolveModel = (segmentType: AdvancedSegmentType, config?: AppConfig) => {
  if (segmentType === "visual_edit") return config?.geminiMultimodalAdvancedVisualModel;
  return config?.geminiMultimodalAdvancedAudioModel;
};

const resolveTimeoutMs = (config?: AppConfig) =>
  config?.geminiMultimodalTimeoutMsAdvanced ??
  config?.geminiMultimodalTimeoutMs ??
  DEFAULT_SEGMENT_TIMEOUT_MS;

const toError = (result: GeminiMultimodalResult) => {
  const isError = result.ok === false;
  const message = isError ? result.errorMessage : "Unknown Gemini multimodal error";
  const type: "InvalidResponse" | "UpstreamError" =
    isError && result.errorCode === ("INVALID_RESPONSE" satisfies GeminiMultimodalErrorCode)
      ? "InvalidResponse"
      : "UpstreamError";
  const error = new GeminiApiError(type, message, result.status) as GeminiApiError & {
    code?: GeminiMultimodalErrorCode;
  };
  if (isError) {
    error.code = result.errorCode;
  }
  return error;
};

const normalizePayload = (raw: unknown): Record<string, unknown> => {
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<string, unknown>;
};

type CompactAnchor = {
  t: number;
  v: number;
  metric?: string;
  type?: string;
  note?: string;
};

type NormalizedAnchor = {
  timeSeconds: number;
  value: number;
  label?: string;
};

type CompactSegmentPayload = {
  scores: Record<string, unknown>;
  anchors?: CompactAnchor[];
  flags?: string[];
};

const parseCompactNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = value.match(/-?\d+(\.\d+)?/);
    if (!match) return undefined;
    const parsed = Number.parseFloat(match[0]);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.score === "number" && Number.isFinite(record.score)) {
      return record.score;
    }
  }
  return undefined;
};

const readCompactScore = (scores: Record<string, unknown> | undefined, keys: string[]): number | undefined => {
  if (!scores) return undefined;
  for (const key of keys) {
    if (key in scores) {
      const parsed = parseCompactNumber(scores[key]);
      if (parsed !== undefined) return parsed;
    }
  }
  return undefined;
};

const normalizeCompactFlags = (raw: unknown): string[] | undefined => {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    const flags = raw.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
    return flags.length > 0 ? flags : undefined;
  }
  if (typeof raw === "string") {
    const flags = raw
      .split(/[,\|]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return flags.length > 0 ? flags : undefined;
  }
  return undefined;
};

const normalizeCompactAnchors = (raw: unknown): CompactAnchor[] | undefined => {
  if (!Array.isArray(raw)) return undefined;
  const anchors: CompactAnchor[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const t = parseCompactNumber(record.t ?? record.time ?? record.timeSeconds);
    const v = parseCompactNumber(record.v ?? record.value);
    if (t === undefined || v === undefined) continue;
    anchors.push({
      t,
      v,
      metric: typeof record.metric === "string" ? record.metric : undefined,
      type: typeof record.type === "string" ? record.type : undefined,
      note: typeof record.note === "string" ? record.note : undefined,
    });
  }
  return anchors.length > 0 ? anchors : undefined;
};

const normalizeAnchors = (
  anchors: CompactAnchor[] | undefined,
  segmentDuration: number,
): NormalizedAnchor[] => {
  if (!anchors || anchors.length === 0 || segmentDuration <= 0) return [];
  return anchors
    .map((anchor) => ({
      timeSeconds: Math.max(0, Math.min(segmentDuration, anchor.t)),
      value: anchor.v,
      label: anchor.type ?? anchor.note,
    }))
    .filter((anchor) => Number.isFinite(anchor.timeSeconds) && Number.isFinite(anchor.value))
    .sort((a, b) => a.timeSeconds - b.timeSeconds);
};

const normalizeCompactPayload = (raw: Record<string, unknown>): CompactSegmentPayload => {
  const scoresRaw =
    raw.scores && typeof raw.scores === "object"
      ? (raw.scores as Record<string, unknown>)
      : raw.metrics && typeof raw.metrics === "object"
        ? (raw.metrics as Record<string, unknown>)
        : raw;
  return {
    scores: scoresRaw,
    anchors: normalizeCompactAnchors(raw.anchors ?? raw.anchorPoints ?? raw.points),
    flags: normalizeCompactFlags(raw.flags ?? raw.tags ?? raw.labels),
  };
};

const normalizeAnchorMetric = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  const normalized = raw.trim().toLowerCase();
  if (["pace", "pacevar", "pace_variability", "pacevariability", "pace_variability_pct"].includes(normalized)) {
    return "pace";
  }
  if (["energy", "energylevel", "energy_level", "energydrift", "energy_drift"].includes(normalized)) {
    return "energy";
  }
  if (["address", "audienceaddress", "audience_address"].includes(normalized)) {
    return "address";
  }
  if (["visualentropy", "visual_entropy", "entropy", "visual"].includes(normalized)) {
    return "visualEntropy";
  }
  return normalized;
};

const groupAnchorsByMetric = (anchors?: CompactAnchor[]): Record<string, CompactAnchor[]> => {
  const grouped: Record<string, CompactAnchor[]> = {};
  if (!anchors) return grouped;
  for (const anchor of anchors) {
    const metric = normalizeAnchorMetric(anchor.metric);
    if (!metric) continue;
    if (!grouped[metric]) {
      grouped[metric] = [];
    }
    grouped[metric].push(anchor);
  }
  return grouped;
};

const variance = (values: number[]) => {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
};

const buildInterpolationDiagnostics = (
  anchors: CompactAnchor[] | undefined,
  segmentDuration: number,
  timeline?: AdvancedTimelinePoint[],
) => {
  if ((!anchors || anchors.length === 0) && (!timeline || timeline.length === 0)) return undefined;
  const normalized = normalizeAnchors(anchors, segmentDuration);
  const anchorValues = normalized.map((anchor) => anchor.value);
  const timelineValues = (timeline ?? []).map((point) => point.value);
  const anchorVariance = variance(anchorValues);
  const timelineVariance = variance(timelineValues);
  const anchorCount = anchors?.length ?? 0;
  const anchorDensityPerSecond = segmentDuration > 0 ? anchorCount / segmentDuration : 0;

  let maxAnchorGapSeconds = segmentDuration;
  if (segmentDuration > 0) {
    const times = normalized.map((anchor) => anchor.timeSeconds);
    if (times.length === 0) {
      maxAnchorGapSeconds = segmentDuration;
    } else {
      const withBounds = [...times];
      if (times[0] > 0) withBounds.unshift(0);
      if (times[times.length - 1] < segmentDuration) withBounds.push(segmentDuration);
      maxAnchorGapSeconds = 0;
      for (let i = 1; i < withBounds.length; i += 1) {
        maxAnchorGapSeconds = Math.max(maxAnchorGapSeconds, withBounds[i] - withBounds[i - 1]);
      }
    }
  }

  return {
    anchorCount,
    anchorDensityPerSecond,
    maxAnchorGapSeconds,
    anchorVariance,
    timelineVariance,
    varianceRatio: anchorVariance > 0 ? timelineVariance / anchorVariance : undefined,
  };
};

const buildTimelineFromAnchors = (
  anchors: CompactAnchor[] | undefined,
  segmentDuration: number,
  targetPoints: number,
): AdvancedTimelinePoint[] | undefined => {
  const sanitized = normalizeAnchors(anchors, segmentDuration);
  if (sanitized.length === 0) return undefined;

  const duration = Math.max(1, segmentDuration);
  const points: AdvancedTimelinePoint[] = [];
  const first = sanitized[0];
  const last = sanitized[sanitized.length - 1];
  const normalized = [...sanitized];
  if (first.timeSeconds > 0) {
    normalized.unshift({ ...first, timeSeconds: 0 });
  }
  if (last.timeSeconds < duration) {
    normalized.push({ ...last, timeSeconds: duration });
  }

  if (normalized.length < 2) {
    return normalized;
  }

  const totalPoints = Math.max(2, targetPoints);
  const step = duration / (totalPoints - 1);
  let anchorIndex = 0;

  for (let i = 0; i < totalPoints; i += 1) {
    const timeSeconds = step * i;
    while (
      anchorIndex < normalized.length - 2 &&
      timeSeconds > normalized[anchorIndex + 1].timeSeconds
    ) {
      anchorIndex += 1;
    }
    const left = normalized[anchorIndex];
    const right = normalized[anchorIndex + 1] ?? left;
    const span = right.timeSeconds - left.timeSeconds;
    const ratio = span > 0 ? (timeSeconds - left.timeSeconds) / span : 0;
    const value = left.value + (right.value - left.value) * ratio;
    points.push({ timeSeconds, value });
  }

  return capTimeline(points, segmentDuration, targetPoints);
};

const describeScoreBand = (score: number | undefined): string => {
  if (score === undefined || !Number.isFinite(score)) return "unobserved";
  if (score >= 80) return "high";
  if (score >= 60) return "moderate";
  if (score >= 40) return "low";
  return "very low";
};

const buildMetricFromScore = (
  score: number | undefined,
  value?: string,
  timeline?: AdvancedTimelinePoint[],
): RichMetric => {
  if (score === undefined || !Number.isFinite(score)) {
    return buildUnobservedMetric();
  }
  const clamped = clampValue(score);
  const metric: RichMetric = {
    score: clamped,
    value: value ?? describeScoreBand(clamped),
    observed: true,
  };
  if (timeline && timeline.length > 0) {
    metric.timeline = timeline;
  }
  return metric;
};

const resolveTimeToHookSeconds = (raw: number | undefined, segmentDuration: number): number | undefined => {
  if (raw === undefined || !Number.isFinite(raw)) return undefined;
  if (segmentDuration > 0 && raw > segmentDuration) {
    const clamped = clampValue(raw);
    return (segmentDuration * (1 - clamped / 100));
  }
  return raw;
};

const buildTimeToHookMetric = (secondsRaw: number | undefined, segmentDuration: number): RichMetric => {
  const seconds = resolveTimeToHookSeconds(secondsRaw, segmentDuration);
  if (seconds === undefined) return buildUnobservedMetric();
  const clampedSeconds = Math.max(0, Math.min(segmentDuration, seconds));
  const score =
    segmentDuration > 0 ? clampValue(100 - (clampedSeconds / segmentDuration) * 100) : clampValue(100 - clampedSeconds);
  return {
    score,
    value: `${Math.round(clampedSeconds * 10) / 10}s`,
    observed: true,
  };
};

const hasAnyKey = (raw: Record<string, unknown>, keys: string[]) =>
  keys.some((key) => Object.prototype.hasOwnProperty.call(raw, key));

const pickFlag = (flags: string[] | undefined, allowed: string[]): string | undefined => {
  if (!flags || flags.length === 0) return undefined;
  return flags.find((flag) => allowed.includes(flag));
};

const formatFlag = (flag?: string): string | undefined =>
  flag ? flag.replace(/_/g, " ") : undefined;

const mapHookSegment = (raw: Record<string, unknown>): Pick<
  SegmentAdvancedMetrics,
  "prosodyArc" | "narrativeArc"
> => {
  const hookAnalysis = resolveSection<Record<string, unknown>>(raw, ["hookAnalysis", "hook_analysis"]) ?? raw;
  const timeToHook = parseMetric(resolveMetricField(hookAnalysis, ["timeToHook", "timeToHookSeconds"]));
  const hookStrength = parseMetric(resolveMetricField(hookAnalysis, ["hookStrength", "hook_strength"]));
  const paceVariability = parseMetric(
    resolveMetricField(hookAnalysis, ["paceVariability", "pace_variability", "paceVariabilityPct"]),
  );
  const energyLevel = parseMetric(
    resolveMetricField(hookAnalysis, ["energyLevel", "energy_level", "energyDrift", "energyDriftDbPerMin"]),
  );

  return {
    narrativeArc: {
      timeToHookSeconds: timeToHook,
      hookStrengthScore: hookStrength,
    },
    prosodyArc: {
      paceVariabilityPct: paceVariability,
      energyDriftDbPerMin: energyLevel,
    },
  };
};

const mapProsodyLanguageSegment = (
  raw: Record<string, unknown>,
): Pick<SegmentAdvancedMetrics, "prosodyArc" | "languageTexture"> => {
  const prosody = resolveSection<Record<string, unknown>>(raw, ["prosody", "prosodyArc", "prosody_arc"]) ?? raw;
  const language = resolveSection<Record<string, unknown>>(raw, [
    "languageTexture",
    "language_texture",
  ]);

  return {
    prosodyArc: {
      paceVariabilityPct: parseMetric(
        resolveMetricField(prosody, ["paceVariability", "pace_variability", "paceVariabilityPct"]),
      ),
      withinSegmentPaceChangePct: parseMetric(
        resolveMetricField(prosody, ["paceWithinSegment", "pace_within_segment", "paceWithinSegmentPct"]),
      ),
      emphasisAlignmentScore: parseMetric(
        resolveMetricField(prosody, ["emphasisAlignment", "emphasis_alignment"]),
      ),
      energyDriftDbPerMin: parseMetric(
        resolveMetricField(prosody, ["energyDrift", "energy_drift", "energyDriftDbPerMin"]),
      ),
    },
    languageTexture: {
      sentenceCompressionRatio: parseMetric(
        resolveMetricField(language, ["sentenceCompression", "sentence_compression"]),
      ),
      humorTimingScore: parseMetric(resolveMetricField(language, ["humorTiming", "humor_timing"])),
      audienceAddressFrequency: parseMetric(
        resolveMetricField(language, ["audienceAddress", "audience_address"]),
      ),
      questionRate: parseMetric(resolveMetricField(language, ["questionRate", "question_rate"])),
    },
  };
};

const mapVisualEditSegment = (
  raw: Record<string, unknown>,
): Pick<SegmentAdvancedMetrics, "visualEditAlignment"> => {
  const visualDynamics = resolveSection<Record<string, unknown>>(raw, [
    "visualDynamics",
    "visual_dynamics",
    "visualEditAlignment",
    "visual_edit_alignment",
  ]);
  const metrics = visualDynamics ?? raw;
  return {
    visualEditAlignment: {
      visualEntropy: parseMetric(resolveMetricField(metrics, ["visualEntropy", "visual_entropy"])),
      cutRateRefinement: parseMetric(resolveMetricField(metrics, ["cutRefinement", "cut_refinement"])),
      silenceForEmphasisFidelity: parseMetric(resolveMetricField(metrics, ["silenceSpans", "silence_spans"])),
      beatsVsEditsAlignment: parseMetric(resolveMetricField(metrics, ["beatEditAlignment", "beat_edit_alignment"])),
    },
  };
};

const mapNarrativeArcSegment = (
  raw: Record<string, unknown>,
): Pick<SegmentAdvancedMetrics, "narrativeArc"> => {
  const narrativeArc = resolveSection<Record<string, unknown>>(raw, [
    "narrativeArc",
    "narrative_arc",
  ]);
  const metrics = narrativeArc ?? raw;
  return {
    narrativeArc: {
      segmentCohesionDrift: parseMetric(resolveMetricField(metrics, ["segmentCohesion", "segment_cohesion"])),
      openLoopsUnresolvedRatio: parseMetric(resolveMetricField(metrics, ["openLoops", "open_loops"])),
    },
  };
};

const mapEndingSegment = (
  raw: Record<string, unknown>,
): Pick<SegmentAdvancedMetrics, "narrativeArc" | "diagnostics"> => {
  const endingAnalysis = resolveSection<Record<string, unknown>>(raw, [
    "endingAnalysis",
    "ending_analysis",
  ]);
  const metrics = endingAnalysis ?? raw;
  return {
    narrativeArc: {
      endingResolutionScore: parseMetric(resolveMetricField(metrics, ["endingResolution", "ending_resolution"])),
    },
    diagnostics: {
      openLoopsResolved: parseMetric(resolveMetricField(metrics, ["openLoopsResolved", "open_loops_resolved"])),
    },
  };
};

const mapCompactHookSegment = (
  payload: CompactSegmentPayload,
  segmentDuration: number,
  maxTimelinePoints: number,
): Pick<SegmentAdvancedMetrics, "prosodyArc" | "narrativeArc" | "diagnostics"> => {
  const groupedAnchors = groupAnchorsByMetric(payload.anchors);
  const paceTimeline = buildTimelineFromAnchors(groupedAnchors.pace, segmentDuration, maxTimelinePoints);
  const energyTimeline = buildTimelineFromAnchors(groupedAnchors.energy, segmentDuration, maxTimelinePoints);
  const paceDiagnostics = buildInterpolationDiagnostics(groupedAnchors.pace, segmentDuration, paceTimeline);
  const energyDiagnostics = buildInterpolationDiagnostics(groupedAnchors.energy, segmentDuration, energyTimeline);
  const scores = payload.scores;
  const flags = payload.flags;
  const hookFlag = formatFlag(
    pickFlag(flags, ["curiosity_gap", "bold_claim", "question", "surprising_fact"]),
  );
  const hookStrengthScore = readCompactScore(scores, ["hookStrength", "hookStrengthScore", "hook"]);

  return {
    narrativeArc: {
      timeToHookSeconds: buildTimeToHookMetric(
        readCompactScore(scores, ["timeToHook", "timeToHookSeconds", "timeToHookSec"]),
        segmentDuration,
      ),
      hookStrengthScore: buildMetricFromScore(
        hookStrengthScore,
        hookStrengthScore !== undefined
          ? hookFlag
            ? `${describeScoreBand(hookStrengthScore)} (${hookFlag})`
            : describeScoreBand(hookStrengthScore)
          : undefined,
      ),
    },
    prosodyArc: {
      paceVariabilityPct: buildMetricFromScore(
        readCompactScore(scores, ["paceVar", "paceVariability", "paceVariabilityPct"]),
        undefined,
        paceTimeline,
      ),
      energyDriftDbPerMin: buildMetricFromScore(
        readCompactScore(scores, ["energy", "energyLevel", "energyDrift"]),
        undefined,
        energyTimeline,
      ),
    },
    diagnostics:
      paceDiagnostics || energyDiagnostics
        ? {
            interpolation: {
              pace: paceDiagnostics,
              energy: energyDiagnostics,
            },
          }
        : undefined,
  };
};

const mapCompactProsodyLanguageSegment = (
  payload: CompactSegmentPayload,
  segmentDuration: number,
  maxTimelinePoints: number,
): Pick<SegmentAdvancedMetrics, "prosodyArc" | "languageTexture" | "diagnostics"> => {
  const groupedAnchors = groupAnchorsByMetric(payload.anchors);
  const paceTimeline = buildTimelineFromAnchors(groupedAnchors.pace, segmentDuration, maxTimelinePoints);
  const energyTimeline = buildTimelineFromAnchors(groupedAnchors.energy, segmentDuration, maxTimelinePoints);
  const addressTimeline = buildTimelineFromAnchors(groupedAnchors.address, segmentDuration, maxTimelinePoints);
  const paceDiagnostics = buildInterpolationDiagnostics(groupedAnchors.pace, segmentDuration, paceTimeline);
  const energyDiagnostics = buildInterpolationDiagnostics(groupedAnchors.energy, segmentDuration, energyTimeline);
  const addressDiagnostics = buildInterpolationDiagnostics(groupedAnchors.address, segmentDuration, addressTimeline);
  const scores = payload.scores;

  return {
    prosodyArc: {
      paceVariabilityPct: buildMetricFromScore(
        readCompactScore(scores, ["paceVar", "paceVariability", "paceVariabilityPct"]),
        undefined,
        paceTimeline,
      ),
      withinSegmentPaceChangePct: buildMetricFromScore(
        readCompactScore(scores, ["paceChange", "paceWithinSegment", "paceWithinSegmentPct"]),
      ),
      emphasisAlignmentScore: buildMetricFromScore(
        readCompactScore(scores, ["emphasis", "emphasisAlignment", "emphasisAlignmentScore"]),
      ),
      energyDriftDbPerMin: buildMetricFromScore(
        readCompactScore(scores, ["energy", "energyDrift", "energyLevel"]),
        undefined,
        energyTimeline,
      ),
    },
    languageTexture: {
      sentenceCompressionRatio: buildMetricFromScore(
        readCompactScore(scores, ["compression", "sentenceCompression", "sentenceCompressionRatio"]),
      ),
      humorTimingScore: buildMetricFromScore(readCompactScore(scores, ["humor", "humorTiming"])),
      audienceAddressFrequency: buildMetricFromScore(
        readCompactScore(scores, ["address", "audienceAddress", "audienceAddressFrequency"]),
        undefined,
        addressTimeline,
      ),
      questionRate: buildMetricFromScore(readCompactScore(scores, ["questionRate", "question_rate", "questions"])),
    },
    diagnostics:
      paceDiagnostics || energyDiagnostics || addressDiagnostics
        ? {
            interpolation: {
              pace: paceDiagnostics,
              energy: energyDiagnostics,
              address: addressDiagnostics,
            },
          }
        : undefined,
  };
};

const mapCompactVisualEditSegment = (
  payload: CompactSegmentPayload,
  segmentDuration: number,
  maxTimelinePoints: number,
): Pick<SegmentAdvancedMetrics, "visualEditAlignment" | "diagnostics"> => {
  const groupedAnchors = groupAnchorsByMetric(payload.anchors);
  const visualTimeline = buildTimelineFromAnchors(groupedAnchors.visualEntropy, segmentDuration, maxTimelinePoints);
  const visualDiagnostics = buildInterpolationDiagnostics(
    groupedAnchors.visualEntropy,
    segmentDuration,
    visualTimeline,
  );
  const scores = payload.scores;

  return {
    visualEditAlignment: {
      visualEntropy: buildMetricFromScore(
        readCompactScore(scores, ["visualEntropy", "visual_entropy", "entropy"]),
        undefined,
        visualTimeline,
      ),
      cutRateRefinement: buildMetricFromScore(
        readCompactScore(scores, ["cutRefine", "cutRefinement", "cutRateRefinement"]),
      ),
      silenceForEmphasisFidelity: buildMetricFromScore(
        readCompactScore(scores, ["silenceFidelity", "silenceSpans", "silenceForEmphasis"]),
      ),
      beatsVsEditsAlignment: buildMetricFromScore(
        readCompactScore(scores, ["beatEditAlign", "beatsEditsAlignment", "beatAlignment"]),
      ),
    },
    diagnostics: visualDiagnostics
      ? {
          interpolation: {
            visualEntropy: visualDiagnostics,
          },
        }
      : undefined,
  };
};

const mapCompactNarrativeArcSegment = (
  payload: CompactSegmentPayload,
): Pick<SegmentAdvancedMetrics, "narrativeArc"> => {
  const scores = payload.scores;
  return {
    narrativeArc: {
      segmentCohesionDrift: buildMetricFromScore(
        readCompactScore(scores, ["cohesion", "segmentCohesion", "segmentCohesionDrift"]),
      ),
      openLoopsUnresolvedRatio: buildMetricFromScore(
        readCompactScore(scores, ["openLoops", "openLoopsUnresolvedRatio", "loops"]),
      ),
    },
  };
};

const mapCompactEndingSegment = (
  payload: CompactSegmentPayload,
): Pick<SegmentAdvancedMetrics, "narrativeArc" | "diagnostics"> => {
  const scores = payload.scores;
  return {
    narrativeArc: {
      endingResolutionScore: buildMetricFromScore(
        readCompactScore(scores, ["endingResolution", "endingResolutionScore", "resolution"]),
      ),
    },
    diagnostics: {
      openLoopsResolved: buildMetricFromScore(
        readCompactScore(scores, ["openLoopsResolved", "loopsResolved", "resolved"]),
      ),
    },
  };
};

const mapCompactSegment = (
  raw: Record<string, unknown>,
  segmentType: AdvancedSegmentType,
  segmentDuration: number,
  maxTimelinePoints: number,
): Partial<SegmentAdvancedMetrics> => {
  switch (segmentType) {
    case "hook":
      if (hasAnyKey(raw, ["hookAnalysis", "hook_analysis"])) {
        return mapHookSegment(raw);
      }
      return mapCompactHookSegment(normalizeCompactPayload(raw), segmentDuration, maxTimelinePoints);
    case "prosody_language":
      if (hasAnyKey(raw, ["prosody", "prosodyArc", "prosody_arc", "languageTexture", "language_texture"])) {
        return mapProsodyLanguageSegment(raw);
      }
      return mapCompactProsodyLanguageSegment(normalizeCompactPayload(raw), segmentDuration, maxTimelinePoints);
    case "visual_edit":
      if (hasAnyKey(raw, ["visualDynamics", "visual_dynamics", "visualEditAlignment", "visual_edit_alignment"])) {
        return mapVisualEditSegment(raw);
      }
      return mapCompactVisualEditSegment(normalizeCompactPayload(raw), segmentDuration, maxTimelinePoints);
    case "narrative_arc":
      if (hasAnyKey(raw, ["narrativeArc", "narrative_arc"])) {
        return mapNarrativeArcSegment(raw);
      }
      return mapCompactNarrativeArcSegment(normalizeCompactPayload(raw));
    case "ending":
      if (hasAnyKey(raw, ["endingAnalysis", "ending_analysis"])) {
        return mapEndingSegment(raw);
      }
      return mapCompactEndingSegment(normalizeCompactPayload(raw));
  }
};

export const analyzeSegmentAdvanced = async (
  input: SegmentAdvancedInput,
): Promise<SegmentAdvancedMetrics> => {
  const segmentId = input.segmentId ?? buildSegmentId(input.segment);
  const chapter = resolveChapter(input.skeleton, input.segment);
  const segmentDuration = Math.max(0, input.segment.endSeconds - input.segment.startSeconds);
  const maxPointsLimit = input.config?.advancedMaxTimelinePoints;
  const maxPoints = maxTimelinePoints(segmentDuration, maxPointsLimit);
  const responseFormat = resolveAdvancedResponseFormat(input.config);
  const prompt = buildPrompt({
    segmentType: input.segment.segmentType,
    segment: input.segment,
    chapter,
    skeleton: input.skeleton,
    maxTimelinePoints: maxPoints,
    responseFormat,
  }).replace("{{youtubeUrl}}", input.youtubeUrl);
  const jsonSchema = resolveSegmentSchema(input.segment.segmentType, responseFormat);
  const jsonSchemaFallback = resolveSegmentSchemaFallback(input.segment.segmentType, responseFormat);
  const schemaOptions = resolveSchemaOptions(input.config, jsonSchema, jsonSchemaFallback);

  const result = await callGeminiMultimodalJson({
    youtubeUrl: input.youtubeUrl,
    prompt,
    systemInstruction,
    jsonSchema: schemaOptions.jsonSchema,
    jsonSchemaFallback: schemaOptions.jsonSchemaFallback,
    forceResponseSchema: schemaOptions.forceResponseSchema,
    config: input.config,
    model: resolveModel(input.segment.segmentType, input.config),
    timeoutMs: resolveTimeoutMs(input.config),
  });

  if (!result.ok) {
    throw toError(result);
  }

  const raw = normalizePayload(result.rawJson);
  const base: SegmentAdvancedMetrics = {
    segmentId,
    chapterId: input.segment.chapterId,
    startSeconds: input.segment.startSeconds,
    endSeconds: input.segment.endSeconds,
    segmentType: input.segment.segmentType,
  };

  let segmentMetrics: SegmentAdvancedMetrics;
  if (responseFormat === "compact") {
    segmentMetrics = {
      ...base,
      ...mapCompactSegment(raw, input.segment.segmentType, segmentDuration, maxPoints),
    };
  } else {
    switch (input.segment.segmentType) {
      case "hook":
        segmentMetrics = { ...base, ...mapHookSegment(raw) };
        break;
      case "prosody_language":
        segmentMetrics = { ...base, ...mapProsodyLanguageSegment(raw) };
        break;
      case "visual_edit":
        segmentMetrics = { ...base, ...mapVisualEditSegment(raw) };
        break;
      case "narrative_arc":
        segmentMetrics = { ...base, ...mapNarrativeArcSegment(raw) };
        break;
      case "ending":
        segmentMetrics = { ...base, ...mapEndingSegment(raw) };
        break;
    }
  }

  const hydrated = ensureHookTimelines(segmentMetrics, segmentDuration);
  return capSegmentTimelines(hydrated, segmentDuration, maxPointsLimit);
};

const estimateSegmentCost = (segment: SegmentPlan, costPerSegment: number) => {
  const duration = Math.max(1, segment.endSeconds - segment.startSeconds);
  const durationFactor = Math.min(1.5, duration / 90);
  return costPerSegment * durationFactor;
};

export const executeAdvancedPass = async (
  plan: AdvancedAnalysisPlan,
  input: AdvancedPassInput,
  config: AdvancedPassConfig = {},
): Promise<AdvancedPassResult> => {
  const maxSegments = config.maxSegments ?? DEFAULT_MAX_SEGMENTS;
  const maxCostUsd = config.maxCostUsd ?? DEFAULT_MAX_COST_USD;
  const maxDurationMs = config.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
  const costPerSegment = config.estimatedCostPerSegmentUsd ?? DEFAULT_ESTIMATED_SEGMENT_COST_USD;

  const cappedSegments = plan.segments.slice(0, maxSegments);
  const results: SegmentAdvancedMetrics[] = [];
  const segmentEstimates: SegmentCostEstimate[] = [];
  let totalCost = 0;
  let segmentsCompleted = 0;
  let segmentsFailed = 0;
  const startedAt = Date.now();
  const logEnabled = process.env.NODE_ENV !== "test";

  for (const segment of cappedSegments) {
    const estimatedSegmentCost = estimateSegmentCost(segment, costPerSegment);
    const segmentId = buildSegmentId(segment);
    const durationSeconds = Math.max(1, segment.endSeconds - segment.startSeconds);
    if (totalCost + estimatedSegmentCost > maxCostUsd) {
      segmentEstimates.push({
        segmentId,
        segmentType: segment.segmentType,
        durationSeconds,
        estimatedCostUsd: estimatedSegmentCost,
        status: "skipped_cost",
      });
      break;
    }
    if (Date.now() - startedAt > maxDurationMs) {
      segmentEstimates.push({
        segmentId,
        segmentType: segment.segmentType,
        durationSeconds,
        estimatedCostUsd: estimatedSegmentCost,
        status: "skipped_duration",
      });
      break;
    }

    try {
      if (logEnabled) {
        console.info("advanced_pass_segment_cost", {
          segmentId,
          segmentType: segment.segmentType,
          durationSeconds,
          estimatedCostUsd: Number(estimatedSegmentCost.toFixed(4)),
        });
      }
      const result = await analyzeSegmentAdvanced({
        youtubeUrl: input.youtubeUrl,
        segment,
        skeleton: input.skeleton,
        config: input.config,
      });
      results.push(result);
      segmentsCompleted += 1;
      totalCost += estimatedSegmentCost;
      segmentEstimates.push({
        segmentId,
        segmentType: segment.segmentType,
        durationSeconds,
        estimatedCostUsd: estimatedSegmentCost,
        status: "completed",
      });
    } catch (error) {
      console.error(`Advanced segment ${segment.chapterId} failed`, error);
      segmentsFailed += 1;
      results.push(
        buildFallbackSegmentMetrics(
          segment,
          segmentId,
          error instanceof Error ? error.message : "Advanced segment failed.",
        ),
      );
      segmentEstimates.push({
        segmentId,
        segmentType: segment.segmentType,
        durationSeconds,
        estimatedCostUsd: estimatedSegmentCost,
        status: "failed",
      });
    }
  }

  if (logEnabled) {
    console.info("advanced_pass_total_cost", {
      segmentsCompleted,
      estimatedCostUsd: Number(totalCost.toFixed(4)),
    });
    if (totalCost > TARGET_TOTAL_COST_MAX_USD) {
      console.warn("advanced_pass_cost_above_target", {
        estimatedCostUsd: Number(totalCost.toFixed(4)),
        targetMaxUsd: TARGET_TOTAL_COST_MAX_USD,
      });
    }
    for (const estimate of segmentEstimates) {
      if (estimate.estimatedCostUsd < TARGET_SEGMENT_COST_MIN_USD || estimate.estimatedCostUsd > TARGET_SEGMENT_COST_MAX_USD) {
        console.warn("advanced_segment_cost_outside_target", {
          segmentId: estimate.segmentId,
          estimatedCostUsd: Number(estimate.estimatedCostUsd.toFixed(4)),
          targetMinUsd: TARGET_SEGMENT_COST_MIN_USD,
          targetMaxUsd: TARGET_SEGMENT_COST_MAX_USD,
        });
      }
    }
  }

  return {
    segments: results,
    diagnostics: {
      segmentsPlanned: plan.segments.length,
      segmentsCompleted,
      segmentsFailed,
      totalDurationMs: Date.now() - startedAt,
      estimatedCostUsd: totalCost,
      segmentEstimates,
    },
  };
};

export { capTimeline, maxTimelinePoints };
