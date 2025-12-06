import { describe, expect, it } from "vitest";
import { performanceCoaching } from "./performanceCoaching";

const baseProfile = {
  scores: {
    hookRetention: 40,
    midVideoRetentionStability: 55,
    lateDropOffSeverity: 30,
    clickThroughRateQuality: 35,
  },
  metrics: {},
  summaryText: "Test",
};

describe("performanceCoaching", () => {
  it("generates actionable insights based on scores", () => {
    const insights = performanceCoaching(baseProfile);
    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0]).toMatch(/Hook retention/);
  });

  it("caps insights to five items", () => {
    const profile = {
      ...baseProfile,
      scores: {
        hookRetention: 80,
        midVideoRetentionStability: 90,
        lateDropOffSeverity: 5,
        clickThroughRateQuality: 90,
      },
      metrics: { avgViewDurationSeconds: 400 },
    };
    const insights = performanceCoaching(profile, {
      voiceIntensity: 50,
      conceptualDepth: 80,
      narrativeStructureStrength: 70,
      visualDynamism: 60,
      productionPolish: 65,
    });
    expect(insights.length).toBeLessThanOrEqual(5);
  });
});
