import type { BeatSegment, SceneSegment } from "../types";
import type { RetentionSample } from "../youtube/analytics";

export type AlignedPoint = {
  timeRatio: number;
  retention: number;
  beatLabel?: string;
  beatRole?: BeatSegment["role"];
  sceneLabel?: string;
};

type BuildTimelineInput = {
  retentionSeries: RetentionSample[];
  beats?: BeatSegment[];
  scenes?: SceneSegment[];
  durationSeconds?: number;
};

const segmentRatio = (segment: { startSeconds: number; endSeconds: number }, durationSeconds?: number) => {
  const duration = durationSeconds && durationSeconds > 0 ? durationSeconds : segment.endSeconds || 1;
  const midpoint = (segment.startSeconds + segment.endSeconds) / 2;
  return midpoint / Math.max(duration, 1);
};

const findNearestBeat = (
  ratio: number,
  beats?: BeatSegment[],
  durationSeconds?: number,
): { label?: string; role?: BeatSegment["role"] } | undefined => {
  if (!beats?.length) return undefined;
  let best: { label: string; role?: BeatSegment["role"]; dist: number } | null = null;
  for (const beat of beats) {
    const segRatio = segmentRatio(beat, durationSeconds);
    const dist = Math.abs(segRatio - ratio);
    if (!best || dist < best.dist) {
      best = { label: beat.label, role: beat.role, dist };
    }
  }
  return best ? { label: best.label, role: best.role } : undefined;
};

const findNearestLabel = <T extends { startSeconds: number; endSeconds: number; label: string }>({
  ratio,
  segments,
  durationSeconds,
}: {
  ratio: number;
  segments?: T[];
  durationSeconds?: number;
}) => {
  if (!segments?.length) return undefined;
  // Assume ratios align roughly; pick the segment whose midpoint is closest to the ratio.
  let best: { label: string; dist: number } | null = null;
  for (const segment of segments) {
    const segRatio = segmentRatio(segment, durationSeconds);
    const dist = Math.abs(segRatio - ratio);
    if (!best || dist < best.dist) {
      best = { label: segment.label, dist };
    }
  }
  return best?.label;
};

export const buildPerformanceTimeline = ({
  retentionSeries,
  beats,
  scenes,
  durationSeconds,
}: BuildTimelineInput): AlignedPoint[] => {
  if (!retentionSeries?.length) return [];
  return retentionSeries.map((point) => {
    const beat = findNearestBeat(point.timeRatio, beats, durationSeconds);
    return {
      timeRatio: point.timeRatio,
      retention: point.audienceRetention,
      beatLabel: beat?.label,
      beatRole: beat?.role,
      sceneLabel: findNearestLabel({ ratio: point.timeRatio, segments: scenes, durationSeconds }),
    };
  });
};
