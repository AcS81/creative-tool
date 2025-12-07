import { describe, expect, it } from "vitest";
import { buildPerformanceProfile } from "./performanceProfile";
import type { VideoAnalytics } from "../youtube/analytics";
import type { AlignedPoint } from "./performanceTimeline";

const analytics: VideoAnalytics = {
  retentionSeries: [
    { timeRatio: 0, audienceRetention: 100 },
    { timeRatio: 0.5, audienceRetention: 70 },
    { timeRatio: 1, audienceRetention: 50 },
  ],
  ctr: 7.5,
  views: 10000,
  likes: 500,
  comments: 120,
  avgViewDurationSeconds: 320,
};

const timeline: AlignedPoint[] = [
  { timeRatio: 0, retention: 100, beatLabel: "Hook", beatRole: "hook" },
  { timeRatio: 0.5, retention: 72, beatLabel: "Mid", beatRole: "escalation" },
  { timeRatio: 1, retention: 48, beatLabel: "End", beatRole: "outro" },
];

describe("buildPerformanceProfile", () => {
  it("computes performance scores and metrics", () => {
    const profile = buildPerformanceProfile({ analytics, timeline });
    expect(profile.scores.hookRetention).toBeGreaterThan(90);
    expect(profile.scores.midVideoRetentionStability).toBeLessThanOrEqual(100);
    expect(profile.metrics.views).toBe(10000);
    expect(profile.metrics.retentionSeries?.length).toBe(3);
    expect(profile.summaryText.length).toBeGreaterThan(0);
  });

  it("clamps values when retention is missing", () => {
    const minimalProfile = buildPerformanceProfile({ analytics: { retentionSeries: [], views: 0 }, timeline: [] });
    expect(minimalProfile.scores.hookRetention).toBeGreaterThanOrEqual(0);
    expect(minimalProfile.scores.hookRetention).toBeLessThanOrEqual(100);
  });
});
