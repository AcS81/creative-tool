import type { ChapterCoreMetrics, CoreMetrics, SummaryMetric } from "./types/coreMetrics";
import type { VideoSkeleton } from "./types/skeleton";
import type { AdvancedSegmentType } from "./types/advancedMetrics";

export type AdvancedAnalysisPlan = {
  segments: SegmentPlan[];
  totalEstimatedCost: number;
  reason: string;
};

export type SegmentPlan = {
  chapterId: string;
  startSeconds: number;
  endSeconds: number;
  segmentType: AdvancedSegmentType;
  reason: string;
  priority: "high" | "medium" | "low";
};

export type AdvancedPlannerConfig = {
  maxSegments?: number;
  segmentMaxSeconds?: number;
  hookMaxSeconds?: number;
  minObservedPct?: number;
  cutRateThreshold?: number;
  structureClarityThreshold?: number;
  estimatedCostPerSegmentUsd?: number;
};

type CoreMetricsInput =
  | CoreMetrics
  | {
      aggregated: CoreMetrics;
      perChapterMetrics?: ChapterCoreMetrics[];
    };

const DEFAULT_MAX_SEGMENTS = 5;
const DEFAULT_SEGMENT_MAX_SECONDS = 120;
const DEFAULT_HOOK_MAX_SECONDS = 90;
const DEFAULT_MIN_OBSERVED_PCT = 40;
const DEFAULT_CUT_RATE_THRESHOLD = 70;
const DEFAULT_STRUCTURE_CLARITY_THRESHOLD = 50;
const DEFAULT_ESTIMATED_SEGMENT_COST_USD = 0.03;

const PRIORITY_WEIGHT: Record<SegmentPlan["priority"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const resolvePerChapterMetrics = (coreMetrics: CoreMetricsInput): ChapterCoreMetrics[] => {
  if ("perChapterMetrics" in coreMetrics && Array.isArray(coreMetrics.perChapterMetrics)) {
    return coreMetrics.perChapterMetrics;
  }
  return [];
};

const isObservedMetric = (metric: SummaryMetric) => {
  if (!metric) return false;
  const value = metric.value.trim().toLowerCase();
  return metric.observed === true && value !== "" && value !== "unobserved";
};

const calculateObservedPct = (chapter: ChapterCoreMetrics) => {
  const metrics = [
    ...Object.values(chapter.voice),
    ...Object.values(chapter.language),
    ...Object.values(chapter.narrative),
    ...Object.values(chapter.visual),
    ...Object.values(chapter.sound),
  ];
  if (metrics.length === 0) return 0;
  const observed = metrics.filter(isObservedMetric).length;
  return (observed / metrics.length) * 100;
};

const capSegmentEnd = (startSeconds: number, endSeconds: number, maxSeconds: number) =>
  Math.min(endSeconds, startSeconds + Math.max(1, maxSeconds));

const addSegment = (segments: SegmentPlan[], segment: SegmentPlan) => {
  const duplicate = segments.some(
    (existing) =>
      existing.chapterId === segment.chapterId &&
      existing.segmentType === segment.segmentType &&
      existing.startSeconds === segment.startSeconds &&
      existing.endSeconds === segment.endSeconds,
  );
  if (!duplicate) {
    segments.push(segment);
  }
};

const resolveHookChapter = (skeleton: VideoSkeleton) =>
  skeleton.chapters.find((chapter) => chapter.chapterType === "hook" || chapter.chapterType === "intro");

const resolveEndingChapter = (skeleton: VideoSkeleton) =>
  skeleton.chapters.find(
    (chapter) => chapter.chapterType === "conclusion" || chapter.chapterType === "outro",
  );

export const planAdvancedAnalysis = (
  skeleton: VideoSkeleton,
  coreMetrics: CoreMetricsInput,
  config: AdvancedPlannerConfig = {},
): AdvancedAnalysisPlan => {
  const perChapterMetrics = resolvePerChapterMetrics(coreMetrics);
  const chapterMetricsMap = new Map(perChapterMetrics.map((chapter) => [chapter.chapterId, chapter]));
  const maxSegments = config.maxSegments ?? DEFAULT_MAX_SEGMENTS;
  const segmentMaxSeconds = config.segmentMaxSeconds ?? DEFAULT_SEGMENT_MAX_SECONDS;
  const hookMaxSeconds = Math.min(config.hookMaxSeconds ?? DEFAULT_HOOK_MAX_SECONDS, segmentMaxSeconds);
  const minObservedPct = config.minObservedPct ?? DEFAULT_MIN_OBSERVED_PCT;
  const cutRateThreshold = config.cutRateThreshold ?? DEFAULT_CUT_RATE_THRESHOLD;
  const structureClarityThreshold = config.structureClarityThreshold ?? DEFAULT_STRUCTURE_CLARITY_THRESHOLD;
  const estimatedCostPerSegmentUsd =
    config.estimatedCostPerSegmentUsd ?? DEFAULT_ESTIMATED_SEGMENT_COST_USD;

  const segments: SegmentPlan[] = [];

  const hookChapter = resolveHookChapter(skeleton);
  if (hookChapter) {
    const duration = hookChapter.endSeconds - hookChapter.startSeconds;
    const maxSeconds = duration > 120 ? hookMaxSeconds : segmentMaxSeconds;
    addSegment(segments, {
      chapterId: hookChapter.id,
      startSeconds: hookChapter.startSeconds,
      endSeconds: capSegmentEnd(hookChapter.startSeconds, hookChapter.endSeconds, maxSeconds),
      segmentType: "hook",
      reason: duration > 120 ? "Hook analysis (first 90s only)" : "Hook analysis",
      priority: "high",
    });
  }

  const endingChapter = resolveEndingChapter(skeleton);
  if (endingChapter) {
    addSegment(segments, {
      chapterId: endingChapter.id,
      startSeconds: endingChapter.startSeconds,
      endSeconds: capSegmentEnd(endingChapter.startSeconds, endingChapter.endSeconds, segmentMaxSeconds),
      segmentType: "ending",
      reason: "Ending analysis",
      priority: "high",
    });
  }

  for (const chapter of skeleton.chapters) {
    const chapterMetrics = chapterMetricsMap.get(chapter.id);
    if (!chapterMetrics) continue;

    const observedPct = calculateObservedPct(chapterMetrics);
    if (observedPct < minObservedPct) {
      continue;
    }

    if (chapterMetrics.visual.cutRate.observed && chapterMetrics.visual.cutRate.score > cutRateThreshold) {
      addSegment(segments, {
        chapterId: chapter.id,
        startSeconds: chapter.startSeconds,
        endSeconds: capSegmentEnd(chapter.startSeconds, chapter.endSeconds, segmentMaxSeconds),
        segmentType: "visual_edit",
        reason: "High cut rate chapter",
        priority: "medium",
      });
    }

    if (
      chapterMetrics.narrative.structureClarity.observed &&
      chapterMetrics.narrative.structureClarity.score < structureClarityThreshold
    ) {
      addSegment(segments, {
        chapterId: chapter.id,
        startSeconds: chapter.startSeconds,
        endSeconds: capSegmentEnd(chapter.startSeconds, chapter.endSeconds, segmentMaxSeconds),
        segmentType: "narrative_arc",
        reason: "Low structure clarity",
        priority: "medium",
      });
    }
  }

  segments.sort((a, b) => {
    const priorityDelta = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (priorityDelta !== 0) return priorityDelta;
    if (a.startSeconds !== b.startSeconds) return a.startSeconds - b.startSeconds;
    return a.chapterId.localeCompare(b.chapterId);
  });

  const cappedSegments = segments.slice(0, Math.max(0, maxSegments));
  const totalEstimatedCost = cappedSegments.length * estimatedCostPerSegmentUsd;
  const reason =
    cappedSegments.length > 0
      ? `Selected ${cappedSegments.length} segments (max ${maxSegments}).`
      : "No eligible segments for advanced analysis.";

  return {
    segments: cappedSegments,
    totalEstimatedCost,
    reason,
  };
};
