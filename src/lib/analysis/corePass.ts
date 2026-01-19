import { z } from "zod";
import type { AppConfig } from "../config";
import {
  callGeminiMultimodalJson,
  GeminiApiError,
  type GeminiMultimodalErrorCode,
  type GeminiMultimodalResult,
} from "../gemini/client";
import { aggregateCoreMetrics, buildFallbackCoreMetrics, buildUnobservedCoreMetrics } from "./aggregation";
import type { ChapterCoreMetrics, CoreMetrics, SummaryMetric } from "./types/coreMetrics";
import type { Chapter, VideoSkeleton } from "./types/skeleton";

export type ChapterCoreInput = {
  youtubeUrl: string;
  startSeconds: number;
  endSeconds: number;
  chapterContext: Chapter;
  videoContext: VideoSkeleton;
};

export type CorePassInput = {
  youtubeUrl: string;
  skeleton: VideoSkeleton;
  config?: AppConfig;
  maxParallel?: number;
};

type ChapterRange = {
  startSeconds: number;
  endSeconds: number;
  capped: boolean;
};

export const DEFAULT_CORE_CHAPTER_TIMEOUT_MS = 45_000;
export const MAX_CORE_CHAPTER_SECONDS = 300;
export const DEFAULT_CORE_MAX_PARALLEL = 5;

const summaryMetricSchema = z.object({
  score: z.number().min(0).max(100),
  value: z.preprocess((value) => (typeof value === "number" ? String(value) : value), z.string()),
  observed: z.boolean(),
});

const buildDomainSchema = (keys: readonly string[]) =>
  z.object(Object.fromEntries(keys.map((key) => [key, summaryMetricSchema]))).passthrough();

const coreMetricsSchema = z
  .object({
    voice: buildDomainSchema([
      "speakingRate",
      "fillerRate",
      "pauseUsage",
      "loudnessRange",
      "pitchVariation",
      "clarity",
      "warmth",
    ]),
    language: buildDomainSchema([
      "concreteness",
      "metaphorDensity",
      "references",
      "humor",
      "teachingVsRiffing",
      "storyPresence",
    ]),
    narrative: buildDomainSchema(["structureClarity", "hookPresence", "transitionQuality", "payoffDelivery"]),
    visual: buildDomainSchema(["cutRate", "environmentStability", "movement", "expression"]),
    sound: buildDomainSchema(["musicCoverage", "musicBalance", "sfxDensity", "silenceUsage"]),
  })
  .passthrough();

const CORE_METRIC_ALIASES: Record<
  keyof CoreMetrics,
  Record<string, string[]>
> = {
  voice: {
    speakingRate: ["speakingRate", "speaking_rate", "speakingRateWpm", "speaking_rate_wpm"],
    fillerRate: ["fillerRate", "filler_rate"],
    pauseUsage: ["pauseUsage", "pause_usage", "pauses"],
    loudnessRange: ["loudnessRange", "loudness_range"],
    pitchVariation: ["pitchVariation", "pitch_variation"],
    clarity: ["clarity"],
    warmth: ["warmth"],
  },
  language: {
    concreteness: ["concreteness"],
    metaphorDensity: ["metaphorDensity", "metaphor_density"],
    references: ["references", "referenceDensity", "reference_density"],
    humor: ["humor"],
    teachingVsRiffing: ["teachingVsRiffing", "teaching_vs_riffing"],
    storyPresence: ["storyPresence", "story_presence"],
  },
  narrative: {
    structureClarity: ["structureClarity", "structure_clarity"],
    hookPresence: ["hookPresence", "hook_presence", "hooks"],
    transitionQuality: ["transitionQuality", "transition_clarity"],
    payoffDelivery: ["payoffDelivery", "payoff_delivery"],
  },
  visual: {
    cutRate: ["cutRate", "cut_rate"],
    environmentStability: ["environmentStability", "environment_stability"],
    movement: ["movement"],
    expression: ["expression"],
  },
  sound: {
    musicCoverage: ["musicCoverage", "music_coverage"],
    musicBalance: ["musicBalance", "music_balance"],
    sfxDensity: ["sfxDensity", "sfx_density"],
    silenceUsage: ["silenceUsage", "silence_usage", "silence_for_emphasis"],
  },
};

const summaryMetricJsonSchema = {
  type: "object",
  properties: {
    score: { type: "number" },
    value: { type: "string" },
    observed: { type: "boolean" },
  },
  required: ["score", "value", "observed"],
};

const buildDomainJsonSchema = (keys: readonly string[]) => ({
  type: "object",
  properties: Object.fromEntries(keys.map((key) => [key, summaryMetricJsonSchema])),
  required: [...keys],
});

const coreMetricsJsonSchema = {
  type: "object",
  properties: {
    voice: buildDomainJsonSchema([
      "speakingRate",
      "fillerRate",
      "pauseUsage",
      "loudnessRange",
      "pitchVariation",
      "clarity",
      "warmth",
    ]),
    language: buildDomainJsonSchema([
      "concreteness",
      "metaphorDensity",
      "references",
      "humor",
      "teachingVsRiffing",
      "storyPresence",
    ]),
    narrative: buildDomainJsonSchema(["structureClarity", "hookPresence", "transitionQuality", "payoffDelivery"]),
    visual: buildDomainJsonSchema(["cutRate", "environmentStability", "movement", "expression"]),
    sound: buildDomainJsonSchema(["musicCoverage", "musicBalance", "sfxDensity", "silenceUsage"]),
  },
  required: ["voice", "language", "narrative", "visual", "sound"],
};

const coreMetricsJsonSchemaLite = {
  type: "object",
  properties: {
    voice: { type: "object" },
    language: { type: "object" },
    narrative: { type: "object" },
    visual: { type: "object" },
    sound: { type: "object" },
  },
  required: ["voice", "language", "narrative", "visual", "sound"],
};

const systemInstruction = [
  "You are a video analysis engine.",
  "Analyze only the specified time range.",
  "Return strict JSON only.",
].join("\n");

export class InvalidCoreMetricsError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Core metrics validation failed: ${issues.join("; ")}`);
    this.name = "InvalidCoreMetricsError";
    this.issues = issues;
    Object.setPrototypeOf(this, InvalidCoreMetricsError.prototype);
  }
}

const formatIssues = (error: z.ZodError) =>
  error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);

const buildUnobservedMetric = (): SummaryMetric => ({
  score: 0,
  value: "unobserved",
  observed: false,
});

const buildUnobservedChapterMetrics = (chapterId: string): ChapterCoreMetrics => ({
  chapterId,
  ...buildUnobservedCoreMetrics(),
});

const clampScore = (value: number) => Math.max(0, Math.min(100, value));

const coerceSummaryMetric = (raw: unknown): SummaryMetric => {
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    const hasScore = typeof record.score === "number";
    const rawValue =
      typeof record.value === "string"
        ? record.value
        : typeof record.value === "number"
          ? String(record.value)
          : "";
    const normalizedValue =
      rawValue.trim() !== "" ? rawValue : hasScore && (record.score as number) > 0 ? String(record.score) : "unobserved";
    const score = hasScore
      ? clampScore(record.score as number)
      : normalizedValue !== "unobserved"
        ? 50
        : 0;
    const observedFlag = typeof record.observed === "boolean" ? record.observed : undefined;
    const observed = observedFlag ?? (normalizedValue.trim().toLowerCase() !== "unobserved" || score > 0);
    return {
      score,
      value: normalizedValue,
      observed,
    };
  }

  if (typeof raw === "number") {
    const score = clampScore(raw);
    return { score, value: String(raw), observed: score > 0 };
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    const observed = trimmed !== "" && trimmed.toLowerCase() !== "unobserved";
    return {
      score: observed ? 50 : 0,
      value: observed ? trimmed : "unobserved",
      observed,
    };
  }

  return buildUnobservedMetric();
};

const resolveMetricField = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (key in source) return source[key];
  }
  return undefined;
};

const buildCoreMetricsLenient = (raw: unknown): CoreMetrics => {
  const base = buildUnobservedCoreMetrics();
  if (!raw || typeof raw !== "object") return base;
  const record = raw as Record<string, unknown>;

  (Object.keys(base) as Array<keyof CoreMetrics>).forEach((domainKey) => {
    const section = record[domainKey];
    if (!section || typeof section !== "object") return;
    const metrics = section as Record<string, unknown>;
    const aliases = CORE_METRIC_ALIASES[domainKey];
    Object.keys(base[domainKey]).forEach((metricKey) => {
      const candidates = aliases[metricKey] ?? [metricKey];
      const rawMetric = resolveMetricField(metrics, candidates);
      if (rawMetric !== undefined) {
        (base[domainKey] as Record<string, SummaryMetric>)[metricKey] = coerceSummaryMetric(rawMetric);
      }
    });
  });

  return base;
};

const normalizeCoreMetricsPayload = (raw: unknown): unknown => {
  if (!raw || typeof raw !== "object") return raw;
  const record = raw as Record<string, unknown>;
  const nested = record.coreMetrics ?? record.core_metrics ?? record.metrics;
  if (nested && typeof nested === "object") {
    return nested;
  }
  return raw;
};

const parseCoreMetrics = (raw: unknown): CoreMetrics => {
  const normalized = normalizeCoreMetricsPayload(raw);
  const result = coreMetricsSchema.safeParse(normalized);
  if (!result.success) {
    const lenient = buildCoreMetricsLenient(normalized);
    if (lenient) {
      console.warn("Core metrics validation failed; using lenient parser.", formatIssues(result.error));
      return lenient;
    }
    throw new InvalidCoreMetricsError(formatIssues(result.error));
  }
  return result.data as unknown as CoreMetrics;
};

const resolveTimeoutMs = (config?: AppConfig) =>
  config?.geminiMultimodalTimeoutMsCore ??
  config?.geminiMultimodalTimeoutMs ??
  DEFAULT_CORE_CHAPTER_TIMEOUT_MS;

const resolveChapterRange = (startSeconds: number, endSeconds: number): ChapterRange => {
  const cappedEnd = Math.min(endSeconds, startSeconds + MAX_CORE_CHAPTER_SECONDS);
  return {
    startSeconds,
    endSeconds: cappedEnd,
    capped: cappedEnd !== endSeconds,
  };
};

const formatKeyMoments = (skeleton: VideoSkeleton, chapterId: string) => {
  const moments = skeleton.keyMoments.filter((moment) => moment.chapterId === chapterId);
  if (moments.length === 0) return "none";
  return moments
    .map((moment) => `${moment.type}@${moment.timestamp}s: ${moment.description}`)
    .join("; ");
};

const formatContentMix = (skeleton: VideoSkeleton) => {
  const mix = skeleton.contentMix;
  return `talkingHead ${mix.talkingHeadPct}%, broll ${mix.brollPct}%, graphics ${mix.graphicsPct}%, screencast ${mix.screencastPct}%, other ${mix.otherPct}%`;
};

const formatAnalysisHints = (skeleton: VideoSkeleton) => {
  const hints = skeleton.analysisHints;
  return [
    `music ${hints.hasMusic ? "yes" : "no"}`,
    `sfx ${hints.hasSFX ? "yes" : "no"}`,
    `on-screen text ${hints.hasOnScreenText ? "yes" : "no"}`,
    `multiple speakers ${hints.hasMultipleSpeakers ? "yes" : "no"}`,
    `language ${hints.primaryLanguage}`,
    `complexity ${hints.estimatedComplexity}`,
  ].join(", ");
};

const buildPrompt = (input: ChapterCoreInput, range: ChapterRange) => {
  const { chapterContext, videoContext } = input;
  const capNote = range.capped ? " (capped at 5 minutes)" : "";
  return [
    `Analyze this chapter of a ${videoContext.videoType} video.`,
    `Video context: "${videoContext.topicSummary}"`,
    `Chapter: "${chapterContext.title}" (${chapterContext.chapterType})`,
    `Chapter summary: "${chapterContext.summary}"`,
    `Time range: ${range.startSeconds}s - ${range.endSeconds}s${capNote}`,
    `Key moments in chapter: ${formatKeyMoments(videoContext, chapterContext.id)}`,
    `Content mix: ${formatContentMix(videoContext)}`,
    `Analysis hints: ${formatAnalysisHints(videoContext)}`,
    "",
    "Return JSON with scores (0-100) and short descriptions for:",
    "- voice: speakingRate, fillerRate, pauseUsage, loudnessRange, pitchVariation, clarity, warmth",
    "- language: concreteness, metaphorDensity, references, humor, teachingVsRiffing, storyPresence",
    "- narrative: structureClarity, hookPresence, transitionQuality, payoffDelivery",
    "- visual: cutRate, environmentStability, movement, expression",
    "- sound: musicCoverage, musicBalance, sfxDensity, silenceUsage",
    'Format: { "domain": { "metric": { "score": number, "value": "short description", "observed": boolean } } }',
    "Mark observed:false if you cannot confidently measure that metric.",
    'speakingRate.value must include numeric WPM (e.g., "145 wpm").',
    'musicCoverage.value must include numeric percent (e.g., "35% with music").',
    'cutRate.value should include numeric seconds per cut (e.g., "4.2s avg").',
    "JSON only.",
  ].join("\n");
};

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

export const analyzeChapterCore = async (
  input: ChapterCoreInput,
  options: { config?: AppConfig } = {},
): Promise<ChapterCoreMetrics> => {
  const range = resolveChapterRange(input.startSeconds, input.endSeconds);
  const prompt = buildPrompt(input, range);
  const config = options.config;
  const result = await callGeminiMultimodalJson({
    youtubeUrl: input.youtubeUrl,
    prompt,
    systemInstruction,
    jsonSchema: coreMetricsJsonSchema,
    jsonSchemaFallback: coreMetricsJsonSchemaLite,
    config,
    model: config?.geminiMultimodalCoreModel,
    timeoutMs: resolveTimeoutMs(config),
  });

  if (!result.ok) {
    throw toError(result);
  }

  const metrics = parseCoreMetrics(result.rawJson);
  return {
    chapterId: input.chapterContext.id,
    ...metrics,
  };
};

const chunkChapters = <T,>(items: T[], size: number) => {
  const safeSize = Math.max(1, size);
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += safeSize) {
    chunks.push(items.slice(index, index + safeSize));
  }
  return chunks;
};

export const analyzeCoreMetrics = async (input: CorePassInput): Promise<CoreMetrics> => {
  const completed = await analyzeCoreChapters(input);
  if (completed.length === 0) {
    return buildFallbackCoreMetrics(input.skeleton);
  }

  return aggregateCoreMetrics(completed, input.skeleton);
};

export const analyzeCoreChapters = async (input: CorePassInput): Promise<ChapterCoreMetrics[]> => {
  const chapters = input.skeleton.chapters;
  if (!chapters || chapters.length === 0) {
    return [];
  }

  const maxParallel = Math.max(1, input.maxParallel ?? DEFAULT_CORE_MAX_PARALLEL);
  const chapterChunks = chunkChapters(chapters, maxParallel);
  const completed: ChapterCoreMetrics[] = [];

  for (const batch of chapterChunks) {
    const settled = await Promise.allSettled(
      batch.map((chapter) =>
        analyzeChapterCore(
          {
            youtubeUrl: input.youtubeUrl,
            startSeconds: chapter.startSeconds,
            endSeconds: chapter.endSeconds,
            chapterContext: chapter,
            videoContext: input.skeleton,
          },
          { config: input.config },
        ),
      ),
    );

    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        completed.push(result.value);
        return;
      }
      const chapter = batch[index];
      console.warn(
        `Core metrics failed for chapter ${chapter?.id ?? "unknown"} (${chapter?.title ?? "unknown"})`,
        result.reason,
      );
      if (chapter?.id) {
        completed.push(buildUnobservedChapterMetrics(chapter.id));
      }
    });
  }

  return completed;
};
