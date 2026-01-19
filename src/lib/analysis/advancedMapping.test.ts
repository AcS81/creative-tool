import { describe, expect, it } from "vitest";
import { mergeAdvancedSegments } from "./advancedMapping";
import { buildDefaultAdvancedMetrics } from "./fingerprint/defaults";
import type { SegmentAdvancedMetrics } from "./types/advancedMetrics";

const metric = (score: number, value: string, observed = true, timeline?: Array<{ timeSeconds: number; value: number }>) => ({
  score,
  value,
  observed,
  timeline,
});

const buildSegment = (
  overrides: Partial<SegmentAdvancedMetrics>,
): SegmentAdvancedMetrics => ({
  segmentId: "seg",
  chapterId: "ch1",
  startSeconds: 0,
  endSeconds: 30,
  segmentType: "hook",
  ...overrides,
});

describe("mergeAdvancedSegments", () => {
  it("uses weighted scores and primary timeline/value based on segment priority", () => {
    const hookSegment = buildSegment({
      segmentId: "hook",
      segmentType: "hook",
      startSeconds: 0,
      endSeconds: 30,
      prosodyArc: {
        energyDriftDbPerMin: metric(80, "hook-value", true, [{ timeSeconds: 0, value: 1 }]),
      },
    });

    const prosodySegment = buildSegment({
      segmentId: "prosody",
      chapterId: "ch2",
      segmentType: "prosody_language",
      startSeconds: 100,
      endSeconds: 160,
      prosodyArc: {
        energyDriftDbPerMin: metric(20, "prosody-value", true, [{ timeSeconds: 10, value: 2 }]),
      },
    });

    const merged = mergeAdvancedSegments([prosodySegment, hookSegment]);
    const mergedMetric = merged.prosodyArc.energyDriftDbPerMin;

    expect(mergedMetric.value).toBe("hook-value");
    expect(mergedMetric.timeline).toEqual(hookSegment.prosodyArc?.energyDriftDbPerMin.timeline);
    expect(mergedMetric.score).toBeCloseTo((80 * 30 + 20 * 60) / 90, 4);
    expect(mergedMetric.observed).toBe(true);
  });

  it("keeps defaults when segments are unobserved", () => {
    const unobservedSegment = buildSegment({
      segmentId: "visual",
      chapterId: "ch3",
      segmentType: "visual_edit",
      startSeconds: 50,
      endSeconds: 70,
      visualEditAlignment: {
        visualEntropy: metric(0, "unobserved", false),
      },
    });

    const merged = mergeAdvancedSegments([unobservedSegment]);
    const defaults = buildDefaultAdvancedMetrics();

    expect(merged.visualEditAlignment.visualEntropy).toEqual(defaults.visualEditAlignment.visualEntropy);
  });
});
