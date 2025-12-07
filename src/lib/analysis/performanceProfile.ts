import type { AlignedPoint } from "./performanceTimeline";
import type { PerformanceProfile } from "../types";
import type { VideoAnalytics } from "../youtube/analytics";

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const nearestValue = (points: AlignedPoint[], ratio: number) => {
  if (!points.length) return undefined;
  return points.reduce<{ value: number; dist: number } | null>((best, point) => {
    const dist = Math.abs(point.timeRatio - ratio);
    if (!best || dist < best.dist) return { value: point.retention, dist };
    return best;
  }, null)?.value;
};

const standardDeviation = (values: number[]) => {
  if (!values.length) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
};

const stabilityScore = (points: AlignedPoint[]) => {
  const midPoints = points.filter((p) => p.timeRatio >= 0.25 && p.timeRatio <= 0.75);
  if (!midPoints.length) return 50;
  const values = midPoints.map((p) => p.retention);
  const std = standardDeviation(values); // typical retention std is small; scale inversely
  const penalty = Math.min(std * 2, 100); // std of 10 -> penalty 20
  return clamp(100 - penalty);
};

const summaryFrom = (args: {
  hookRetention: number;
  midRetention: number;
  endRetention: number;
  lateDropOffSeverity: number;
  ctr?: number;
}) => {
  const parts: string[] = [];
  parts.push(`Hook holds ~${Math.round(args.hookRetention)}% of viewers; mid-video sits near ${Math.round(args.midRetention)}%.`);
  parts.push(`Late drop-off costs about ${Math.round(args.lateDropOffSeverity)} points by the end.`);
  if (args.ctr != null) {
    parts.push(`CTR is ${args.ctr.toFixed(1)}%.`);
  }
  return parts.join(" ");
};

export const buildPerformanceProfile = ({
  analytics,
  timeline,
}: {
  analytics: VideoAnalytics;
  timeline: AlignedPoint[];
}): PerformanceProfile => {
  const firstRetention = timeline[0]?.retention ?? analytics.retentionSeries[0]?.audienceRetention ?? 0;
  const hookRetention = nearestValue(timeline, 0.05) ?? firstRetention;
  const midRetention = nearestValue(timeline, 0.5) ?? hookRetention;
  const endRetention = nearestValue(timeline, 0.95) ?? midRetention;

  const lateDropOffSeverity = clamp(Math.max(0, hookRetention - endRetention));
  const midVideoRetentionStability = stabilityScore(timeline);
  const clickThroughRateQuality = clamp(analytics.ctr ?? 0);

  const summaryText = summaryFrom({
    hookRetention,
    midRetention,
    endRetention,
    lateDropOffSeverity,
    ctr: analytics.ctr,
  });

  return {
    scores: {
      hookRetention: clamp(hookRetention),
      midVideoRetentionStability,
      lateDropOffSeverity,
      clickThroughRateQuality,
    },
    metrics: {
      views: analytics.views,
      likes: analytics.likes,
      comments: analytics.comments,
      ctr: analytics.ctr,
      avgViewDurationSeconds: analytics.avgViewDurationSeconds,
      retentionSeries: timeline.map((p) => ({
        timeRatio: p.timeRatio,
        audienceRetention: p.retention,
        beatLabel: p.beatLabel,
        beatRole: p.beatRole,
        sceneLabel: p.sceneLabel,
      })),
    },
    summaryText,
    insights: [
      `Mid-video stability score: ${Math.round(midVideoRetentionStability)}.`,
      `Late drop-off severity: ${Math.round(lateDropOffSeverity)}.`,
    ],
  };
};
