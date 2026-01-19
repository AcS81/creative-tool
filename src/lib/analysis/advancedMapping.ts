import type { 
  AdvancedFingerprintMetrics, 
  LanguageTexture,
  NarrativeArc,
  ProsodyArc,
  ScoredMetric,
  VisualEditAlignment,
} from "../types";
import { buildDefaultAdvancedMetrics } from "./fingerprint/defaults";
import type { AdvancedSegmentType, SegmentAdvancedMetrics } from "./types/advancedMetrics";

type MetricContribution = {
  metric: ScoredMetric;
  segment: SegmentAdvancedMetrics;
  durationSeconds: number;
  priority: number;
};

const SEGMENT_PRIORITY: Record<AdvancedSegmentType, number> = {
  hook: 0,
  ending: 1,
  narrative_arc: 2,
  prosody_language: 2,
  visual_edit: 2,
};

export const isObservedMetric = (metric?: ScoredMetric) => {
  if (!metric) return false;
  const value = typeof metric.value === "string" ? metric.value.trim().toLowerCase() : "";
  const hasValue = value !== "" && value !== "unobserved";
  const hasScore = typeof metric.score === "number" && metric.score > 0;
  return metric.observed === true || hasValue || hasScore;
};

const getSegmentDuration = (segment: SegmentAdvancedMetrics) =>
  Math.max(1, segment.endSeconds - segment.startSeconds);

type SharedSectionKey = "prosodyArc" | "languageTexture" | "narrativeArc" | "visualEditAlignment";

const collectContributions = <T extends { [K in keyof T]: ScoredMetric }>(
  segments: SegmentAdvancedMetrics[],
  sectionKey: SharedSectionKey,
  metricKey: keyof T,
): MetricContribution[] => {
  const contributions: MetricContribution[] = [];
  for (const segment of segments) {
    const section = segment[sectionKey] as Partial<T> | undefined;
    const metric = section?.[metricKey];
    if (!metric || !isObservedMetric(metric)) continue;
    contributions.push({
      metric,
      segment,
      durationSeconds: getSegmentDuration(segment),
      priority: SEGMENT_PRIORITY[segment.segmentType],
    });
  }
  return contributions;
};

const pickPrimaryContribution = (contributions: MetricContribution[]): MetricContribution => {
  return [...contributions].sort((a, b) => {
    const priorityDelta = a.priority - b.priority;
    if (priorityDelta !== 0) return priorityDelta;
    if (a.durationSeconds !== b.durationSeconds) return b.durationSeconds - a.durationSeconds;
    if (a.segment.startSeconds !== b.segment.startSeconds) {
      return a.segment.startSeconds - b.segment.startSeconds;
    }
    return a.segment.chapterId.localeCompare(b.segment.chapterId);
  })[0];
};

const buildMergedMetric = (base: ScoredMetric, contributions: MetricContribution[]): ScoredMetric => {
  if (contributions.length === 0) return base;
  const primary = pickPrimaryContribution(contributions);
  const totalWeight = contributions.reduce((sum, entry) => sum + entry.durationSeconds, 0);
  const weightedScore =
    totalWeight > 0
      ? contributions.reduce((sum, entry) => sum + entry.metric.score * entry.durationSeconds, 0) / totalWeight
      : primary.metric.score;

  return {
    ...base,
    ...primary.metric,
    score: weightedScore,
    observed: true,
  };
};

const mergeSection = <T extends { [K in keyof T]: ScoredMetric }>(
  baseSection: T,
  segments: SegmentAdvancedMetrics[],
  sectionKey: SharedSectionKey,
): T => {
  const mergedEntries = (Object.entries(baseSection) as [keyof T & string, ScoredMetric][]).map(([metricKey, baseMetric]) => {
    const contributions = collectContributions<T>(segments, sectionKey, metricKey);
    const merged = buildMergedMetric(baseMetric, contributions);
    return [metricKey, merged] as const;
  });
  return Object.fromEntries(mergedEntries) as T;
};

export const mergeAdvancedSegments = (
  segments: SegmentAdvancedMetrics[],
): AdvancedFingerprintMetrics => {
  const base = buildDefaultAdvancedMetrics();
  if (!segments || segments.length === 0) return base;

  return {
    ...base,
    prosodyArc: mergeSection<ProsodyArc>(base.prosodyArc, segments, "prosodyArc"),
    languageTexture: mergeSection<LanguageTexture>(base.languageTexture, segments, "languageTexture"),
    narrativeArc: mergeSection<NarrativeArc>(base.narrativeArc, segments, "narrativeArc"),
    visualEditAlignment: mergeSection<VisualEditAlignment>(base.visualEditAlignment, segments, "visualEditAlignment"),
  };
};
