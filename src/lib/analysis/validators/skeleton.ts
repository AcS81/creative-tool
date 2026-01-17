import { z } from "zod";
import type {
  AnalysisHints,
  Chapter,
  ContentMix,
  KeyMoment,
  VideoSkeleton,
} from "../types/skeleton";

const DESCRIPTION_MAX_WORDS = 15;
const CONTENT_MIX_SUM_TOLERANCE = 5;

const countWords = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

const descriptionSchema = z.string().min(1).refine((value) => countWords(value) <= DESCRIPTION_MAX_WORDS, {
  message: `must be ${DESCRIPTION_MAX_WORDS} words or fewer`,
});

export const chapterSchema: z.ZodType<Chapter> = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    startSeconds: z.number().min(0),
    endSeconds: z.number().min(0),
    summary: descriptionSchema,
    chapterType: z.enum(["intro", "hook", "body", "example", "tangent", "conclusion", "cta", "outro"]),
  })
  .refine((value) => value.endSeconds > value.startSeconds, {
    message: "endSeconds must be greater than startSeconds",
    path: ["endSeconds"],
  });

export const keyMomentSchema: z.ZodType<KeyMoment> = z.object({
  type: z.enum(["hook", "peak", "twist", "payoff", "cta"]),
  timestamp: z.number().min(0),
  chapterId: z.string().min(1),
  description: descriptionSchema,
});

const contentMixSchema: z.ZodType<ContentMix> = z
  .object({
    talkingHeadPct: z.number().min(0).max(100),
    brollPct: z.number().min(0).max(100),
    graphicsPct: z.number().min(0).max(100),
    screencastPct: z.number().min(0).max(100),
    otherPct: z.number().min(0).max(100),
  })
  .refine((mix) => {
    const sum =
      mix.talkingHeadPct +
      mix.brollPct +
      mix.graphicsPct +
      mix.screencastPct +
      mix.otherPct;
    return Math.abs(sum - 100) <= CONTENT_MIX_SUM_TOLERANCE;
  }, {
    message: `contentMix percentages must sum to 100 +/- ${CONTENT_MIX_SUM_TOLERANCE}`,
  });

const analysisHintsSchema: z.ZodType<AnalysisHints> = z.object({
  hasMusic: z.boolean(),
  hasSFX: z.boolean(),
  hasOnScreenText: z.boolean(),
  hasMultipleSpeakers: z.boolean(),
  primaryLanguage: z.string().min(1),
  estimatedComplexity: z.enum(["low", "medium", "high"]),
});

const videoSkeletonSchemaBase = z.object({
  durationSeconds: z.number().min(0),
  videoType: z.enum([
    "tutorial",
    "essay",
    "vlog",
    "reaction",
    "interview",
    "documentary",
    "entertainment",
    "other",
  ]),
  topicSummary: z.string().min(1),
  chapters: z.array(chapterSchema).min(2).max(10),
  keyMoments: z.array(keyMomentSchema).min(1).max(7),
  contentMix: contentMixSchema,
  analysisHints: analysisHintsSchema,
});

export const videoSkeletonSchema: z.ZodType<VideoSkeleton> = videoSkeletonSchemaBase;

export const videoSkeletonSchemaPartial: z.ZodType<Partial<VideoSkeleton>> =
  videoSkeletonSchemaBase.partial();

export class InvalidVideoSkeletonError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Video skeleton validation failed: ${issues.join("; ")}`);
    this.name = "InvalidVideoSkeletonError";
    this.issues = issues;
    Object.setPrototypeOf(this, InvalidVideoSkeletonError.prototype);
  }
}

const formatIssues = (error: z.ZodError) =>
  error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`);

export const validateVideoSkeleton = (data: unknown): VideoSkeleton => {
  const result = videoSkeletonSchema.safeParse(data);
  if (!result.success) {
    throw new InvalidVideoSkeletonError(formatIssues(result.error));
  }
  return result.data;
};

export const safeValidateVideoSkeleton = (
  data: unknown,
): { success: boolean; data?: VideoSkeleton; error?: string } => {
  const result = videoSkeletonSchema.safeParse(data);
  if (!result.success) {
    return { success: false, error: formatIssues(result.error).join("; ") };
  }
  return { success: true, data: result.data };
};

export const safeValidateVideoSkeletonPartial = (
  data: unknown,
): { success: boolean; data?: Partial<VideoSkeleton>; error?: string } => {
  const result = videoSkeletonSchemaPartial.safeParse(data);
  if (!result.success) {
    return { success: false, error: formatIssues(result.error).join("; ") };
  }
  return { success: true, data: result.data };
};
