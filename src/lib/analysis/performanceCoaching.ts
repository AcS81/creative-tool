import type { MetaAxes, PerformanceProfile } from "../types";

export const performanceCoaching = (
  profile: PerformanceProfile,
  metaAxes?: MetaAxes,
): string[] => {
  const insights: string[] = [];
  const { scores, metrics } = profile;

  if (scores.hookRetention < 50) {
    insights.push(
      "Hook retention is weak; tighten the first 10 seconds with a sharper visual change or question.",
    );
  } else if (scores.hookRetention > 75) {
    insights.push("Strong hook retention; keep your current openers and maintain pacing into minute one.");
  }

  if (scores.midVideoRetentionStability < 60) {
    insights.push("Mid-video stability dips; add pattern interrupts or story beats around the halfway mark.");
  } else if (scores.midVideoRetentionStability > 80) {
    insights.push("Mid-video stability is solid; consider front-loading your best sections to capitalize on it.");
  }

  if (scores.lateDropOffSeverity > 25) {
    insights.push("Late drop-off is heavy; shorten the outro and move CTAs earlier when energy is higher.");
  }

  if (scores.clickThroughRateQuality < 40) {
    insights.push("CTR is low; test clearer titles/thumbnails that foreground the core payoff.");
  }

  if (metrics.avgViewDurationSeconds && metrics.avgViewDurationSeconds > 300 && metaAxes?.conceptualDepth) {
    insights.push(
      "Long average view duration suggests viewers stay for depth; keep explanations concise but preserve substance.",
    );
  }

  return insights.slice(0, 5);
};
