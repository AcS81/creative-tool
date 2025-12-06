import { describe, expect, it } from "vitest";
import { buildPerformanceTimeline } from "./performanceTimeline";

const retentionSeries = [
  { timeRatio: 0, audienceRetention: 100 },
  { timeRatio: 0.5, audienceRetention: 70 },
  { timeRatio: 1, audienceRetention: 45 },
];

const beats = [
  { startSeconds: 0, endSeconds: 10, label: "Hook", devices: [] },
  { startSeconds: 10, endSeconds: 20, label: "Setup", devices: [] },
];

const scenes = [
  { startSeconds: 0, endSeconds: 10, label: "Intro", shortSummary: "Intro" },
  { startSeconds: 10, endSeconds: 20, label: "Main", shortSummary: "Main" },
];

describe("performanceTimeline", () => {
  it("aligns retention with beats and scenes", () => {
    const timeline = buildPerformanceTimeline({ retentionSeries, beats, scenes });
    expect(timeline).toHaveLength(3);
    expect(timeline[0].beatLabel).toBeDefined();
    expect(timeline[1].sceneLabel).toBeDefined();
  });

  it("handles missing beats/scenes gracefully", () => {
    const timeline = buildPerformanceTimeline({ retentionSeries });
    expect(timeline[0].beatLabel).toBeUndefined();
    expect(timeline[0].sceneLabel).toBeUndefined();
  });
});
