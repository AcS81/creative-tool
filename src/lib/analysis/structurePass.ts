import type { AppConfig } from "../config";
import { callGeminiTextJson } from "../gemini/client";
import { InvalidVideoSkeletonError, validateVideoSkeleton } from "./validators/skeleton";
import type { Chapter, VideoSkeleton } from "./types/skeleton";

export type StructurePassInput = {
  youtubeUrl: string;
  durationSeconds?: number;
  youtubeChapters?: string[];
};

export type StructurePassResult = {
  skeleton: VideoSkeleton;
  source: "gemini" | "fallback";
  error?: string;
};

export type FallbackInput = {
  durationSeconds?: number;
  youtubeChapters?: string[];
};

type CountRange = {
  min: number;
  max: number;
};

type CountGuidance = {
  chapters: CountRange;
  keyMoments: CountRange;
};

const DEFAULT_CHAPTER_RANGE: CountRange = { min: 3, max: 7 };
const DEFAULT_KEY_MOMENT_RANGE: CountRange = { min: 2, max: 5 };
const DEFAULT_FALLBACK_DURATION_SECONDS = 300;

export const DEFAULT_STRUCTURE_PASS_TIMEOUT_MS = 30_000;

const buildCountGuidance = (durationSeconds?: number): CountGuidance => {
  if (!durationSeconds || durationSeconds <= 0) {
    return { chapters: DEFAULT_CHAPTER_RANGE, keyMoments: DEFAULT_KEY_MOMENT_RANGE };
  }
  if (durationSeconds < 3 * 60) {
    return { chapters: { min: 3, max: 4 }, keyMoments: { min: 2, max: 3 } };
  }
  if (durationSeconds <= 10 * 60) {
    return { chapters: { min: 4, max: 5 }, keyMoments: { min: 3, max: 4 } };
  }
  if (durationSeconds <= 20 * 60) {
    return { chapters: { min: 5, max: 6 }, keyMoments: { min: 4, max: 5 } };
  }
  return { chapters: { min: 6, max: 7 }, keyMoments: { min: 5, max: 5 } };
};

const formatRange = (range: CountRange) =>
  range.min === range.max ? `${range.min}` : `${range.min}-${range.max}`;

const formatYoutubeChapters = (chapters?: string[]) => {
  if (!chapters || chapters.length === 0) {
    return "None provided.";
  }
  return chapters.map((title) => `- ${title}`).join("\n");
};

const resolveStructurePassTimeoutMs = (config?: AppConfig) =>
  config?.structurePassTimeoutMs ?? DEFAULT_STRUCTURE_PASS_TIMEOUT_MS;

const resolveStructurePassEnabled = (config?: AppConfig) =>
  config?.structurePassEnabled ?? true;

const resolveFallbackDuration = (durationSeconds?: number) => {
  if (durationSeconds && durationSeconds > 0) return durationSeconds;
  return DEFAULT_FALLBACK_DURATION_SECONDS;
};

const resolveChapterCount = (range: CountRange) =>
  Math.max(2, Math.round((range.min + range.max) / 2));

const resolveFallbackChapterType = (index: number, count: number): Chapter["chapterType"] => {
  if (index === 0) return "intro";
  if (index === count - 1) return "outro";
  return "body";
};

const buildFallbackChapters = (
  durationSeconds: number,
  count: number,
  titles?: string[],
): Chapter[] => {
  const adjustedDuration = Math.max(durationSeconds, count);
  const chapters: Chapter[] = [];
  for (let index = 0; index < count; index += 1) {
    const startSeconds = Math.floor((adjustedDuration / count) * index);
    const endSeconds =
      index === count - 1
        ? adjustedDuration
        : Math.floor((adjustedDuration / count) * (index + 1));
    chapters.push({
      id: `ch${index + 1}`,
      title: titles?.[index]?.trim() || `Chapter ${index + 1}`,
      startSeconds,
      endSeconds: Math.max(endSeconds, startSeconds + 1),
      summary: "Auto-generated fallback chapter.",
      chapterType: resolveFallbackChapterType(index, count),
    });
  }
  return chapters;
};

export const buildFallbackSkeleton = (input: FallbackInput): VideoSkeleton => {
  const durationSeconds = resolveFallbackDuration(input.durationSeconds);
  const guidance = buildCountGuidance(durationSeconds);
  const chapterCount = resolveChapterCount(guidance.chapters);
  const chapters = buildFallbackChapters(durationSeconds, chapterCount, input.youtubeChapters);
  const firstChapter = chapters[0];

  return {
    durationSeconds,
    videoType: "other",
    topicSummary: "Fallback structure for an unparsed video. Details may be incomplete.",
    chapters,
    keyMoments: [
      {
        type: "hook",
        timestamp: firstChapter?.startSeconds ?? 0,
        chapterId: firstChapter?.id ?? "ch1",
        description: "No key moments detected.",
      },
    ],
    contentMix: {
      talkingHeadPct: 0,
      brollPct: 0,
      graphicsPct: 0,
      screencastPct: 0,
      otherPct: 100,
    },
    analysisHints: {
      hasMusic: false,
      hasSFX: false,
      hasOnScreenText: false,
      hasMultipleSpeakers: false,
      primaryLanguage: "unknown",
      estimatedComplexity: "medium",
    },
  };
};

const systemInstruction =
  "You are a video structure analyzer. Your job is to understand how a video is organized, not to measure or score anything.";

const structurePassJsonSchema = {
  type: "object",
  properties: {
    durationSeconds: { type: "number" },
    videoType: {
      type: "string",
      enum: [
        "tutorial",
        "essay",
        "vlog",
        "reaction",
        "interview",
        "documentary",
        "entertainment",
        "other",
      ],
    },
    topicSummary: { type: "string" },
    chapters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          startSeconds: { type: "number" },
          endSeconds: { type: "number" },
          summary: { type: "string" },
          chapterType: {
            type: "string",
            enum: ["intro", "hook", "body", "example", "tangent", "conclusion", "cta", "outro"],
          },
        },
        required: ["id", "title", "startSeconds", "endSeconds", "summary", "chapterType"],
      },
    },
    keyMoments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["hook", "peak", "twist", "payoff", "cta"] },
          timestamp: { type: "number" },
          chapterId: { type: "string" },
          description: { type: "string" },
        },
        required: ["type", "timestamp", "chapterId", "description"],
      },
    },
    contentMix: {
      type: "object",
      properties: {
        talkingHeadPct: { type: "number" },
        brollPct: { type: "number" },
        graphicsPct: { type: "number" },
        screencastPct: { type: "number" },
        otherPct: { type: "number" },
      },
      required: ["talkingHeadPct", "brollPct", "graphicsPct", "screencastPct", "otherPct"],
    },
    analysisHints: {
      type: "object",
      properties: {
        hasMusic: { type: "boolean" },
        hasSFX: { type: "boolean" },
        hasOnScreenText: { type: "boolean" },
        hasMultipleSpeakers: { type: "boolean" },
        primaryLanguage: { type: "string" },
        estimatedComplexity: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: [
        "hasMusic",
        "hasSFX",
        "hasOnScreenText",
        "hasMultipleSpeakers",
        "primaryLanguage",
        "estimatedComplexity",
      ],
    },
  },
  required: ["durationSeconds", "videoType", "topicSummary", "chapters", "keyMoments", "contentMix", "analysisHints"],
};

const MAX_DESCRIPTION_WORDS = 15;

const truncateWords = (value: string, maxWords: number) => {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value.trim();
  return words.slice(0, maxWords).join(" ");
};

const safeClone = <T,>(value: T): T => {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
};

const sanitizeSkeletonText = (raw: unknown): unknown => {
  if (!raw || typeof raw !== "object") return raw;
  const clone = safeClone(raw as Record<string, unknown>) as {
    chapters?: Array<{ summary?: string }>;
    keyMoments?: Array<{ description?: string }>;
  };

  if (Array.isArray(clone.chapters)) {
    clone.chapters = clone.chapters.map((chapter) => ({
      ...chapter,
      summary:
        typeof chapter.summary === "string"
          ? truncateWords(chapter.summary, MAX_DESCRIPTION_WORDS)
          : chapter.summary,
    }));
  }

  if (Array.isArray(clone.keyMoments)) {
    clone.keyMoments = clone.keyMoments.map((moment) => ({
      ...moment,
      description:
        typeof moment.description === "string"
          ? truncateWords(moment.description, MAX_DESCRIPTION_WORDS)
          : moment.description,
    }));
  }

  return clone;
};

const buildPrompt = (input: StructurePassInput) => {
  const guidance = buildCountGuidance(input.durationSeconds);
  const chapterRange = formatRange(guidance.chapters);
  const keyMomentRange = formatRange(guidance.keyMoments);
  const durationLine = input.durationSeconds
    ? `DURATION: ${input.durationSeconds} seconds`
    : "DURATION: unknown";
  const chaptersLine = `YOUTUBE CHAPTERS:\n${formatYoutubeChapters(input.youtubeChapters)}`;
  const chapterRule =
    guidance.chapters.min === guidance.chapters.max
      ? `Chapters: Create exactly ${chapterRange} chapters that evenly cover the video.`
      : `Chapters: Create ${chapterRange} chapters that evenly cover the video.`;
  const keyMomentRule =
    guidance.keyMoments.min === guidance.keyMoments.max
      ? `keyMoments: Only ${keyMomentRange} most important narrative moments.`
      : `keyMoments: Only ${keyMomentRange} most important narrative moments.`;

  return `Analyze the structure of this YouTube video.

VIDEO URL: ${input.youtubeUrl}
${durationLine}
${chaptersLine}

Return JSON matching this exact schema:

VideoType guide (pick ONE best match):
- tutorial: step-by-step instruction or how-to teaching
- essay: analytical commentary, argument, or reflective narration
- vlog: personal diary, day-in-the-life, or travel log
- reaction: host reacts to another video or content
- interview: Q&A format with one or more guests
- documentary: factual, real-world narrative or investigative storytelling
- entertainment: performance-driven, gaming, comedy, or variety content
- other: none of the above clearly fit

{
  "durationSeconds": number,
  "videoType": "tutorial" | "essay" | "vlog" | "reaction" | "interview" | "documentary" | "entertainment" | "other",
  "topicSummary": "2-3 sentence summary of what this video is about",
  "chapters": [
    {
      "id": "ch1",
      "title": "Chapter title",
      "startSeconds": number,
      "endSeconds": number,
      "summary": "One sentence describing this chapter",
      "chapterType": "intro" | "hook" | "body" | "example" | "tangent" | "conclusion" | "cta" | "outro"
    }
  ],
  "keyMoments": [
    {
      "type": "hook" | "peak" | "twist" | "payoff" | "cta",
      "timestamp": number,
      "chapterId": "ch1",
      "description": "10 words max describing this moment"
    }
  ],
  "contentMix": {
    "talkingHeadPct": number,
    "brollPct": number,
    "graphicsPct": number,
    "screencastPct": number,
    "otherPct": number
  },
  "analysisHints": {
    "hasMusic": boolean,
    "hasSFX": boolean,
    "hasOnScreenText": boolean,
    "hasMultipleSpeakers": boolean,
    "primaryLanguage": string,
    "estimatedComplexity": "low" | "medium" | "high"
  }
}

RULES:
1. ${chapterRule}
2. If YouTube chapters are provided above, use those titles (merge or trim to fit).
3. ${keyMomentRule}
4. If a clear hook appears in the first 15 seconds, mark that as the hook keyMoment.
5. All descriptions under 15 words. Chapter summaries are one sentence.
6. contentMix percentages must sum to 100.
7. Timestamps are seconds from start.
8. JSON only, no prose.`;
};

export const runStructurePass = async (
  input: StructurePassInput,
  options: { config?: AppConfig } = {},
): Promise<StructurePassResult> => {
  if (!resolveStructurePassEnabled(options.config)) {
    return {
      skeleton: buildFallbackSkeleton({
        durationSeconds: input.durationSeconds,
        youtubeChapters: input.youtubeChapters,
      }),
      source: "fallback",
      error: "Structure pass disabled via ENABLE_STRUCTURE_PASS=false.",
    };
  }

  const prompt = buildPrompt(input);
  const controller = new AbortController();
  let didTimeout = false;
  const timeoutMs = resolveStructurePassTimeoutMs(options.config);
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    const jsonSchema = options.config?.geminiResponseSchemaEnabled ? structurePassJsonSchema : undefined;
    const result = await callGeminiTextJson({
      prompt,
      systemInstruction,
      jsonSchema,
      signal: controller.signal,
      config: options.config,
    });
    let skeleton: VideoSkeleton;
    try {
      skeleton = validateVideoSkeleton(result.rawJson);
    } catch (error) {
      if (!(error instanceof InvalidVideoSkeletonError)) {
        throw error;
      }
      const sanitized = sanitizeSkeletonText(result.rawJson);
      skeleton = validateVideoSkeleton(sanitized);
    }
    return { skeleton, source: "gemini" };
  } catch (error) {
    const message = didTimeout
      ? `Timed out after ${Math.round(timeoutMs / 1000)}s while waiting for Gemini.`
      : error instanceof Error
        ? error.message
        : "Unknown structure pass error.";
    console.warn("Structure pass failed; using fallback.", message, error);
    return {
      skeleton: buildFallbackSkeleton({
        durationSeconds: input.durationSeconds,
        youtubeChapters: input.youtubeChapters,
      }),
      source: "fallback",
      error: message,
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

export const extractVideoSkeleton = async (input: StructurePassInput): Promise<VideoSkeleton> => {
  const result = await runStructurePass(input);
  return result.skeleton;
};
