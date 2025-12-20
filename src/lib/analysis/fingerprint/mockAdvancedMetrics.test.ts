import { describe, expect, it } from "vitest";

import { buildMockAdvancedMetrics, computeSecondOrderScores } from "./mockAdvancedMetrics";

describe("computeSecondOrderScores", () => {
  it("yields higher alignment and timing when component metrics are stronger", () => {
    const base = buildMockAdvancedMetrics(7);

    const aligned = computeSecondOrderScores({
      ...base,
      prosodyArc: {
        ...base.prosodyArc,
        emphasisAlignmentScore: { ...base.prosodyArc.emphasisAlignmentScore, score: 90 },
      },
      visualEditAlignment: {
        ...base.visualEditAlignment,
        audioVisualEmphasisAlignment: { ...base.visualEditAlignment.audioVisualEmphasisAlignment, score: 88 },
        beatsVsEditsAlignment: { ...base.visualEditAlignment.beatsVsEditsAlignment, score: 86 },
      },
    });

    const drifty = computeSecondOrderScores({
      ...base,
      prosodyArc: {
        ...base.prosodyArc,
        emphasisAlignmentScore: { ...base.prosodyArc.emphasisAlignmentScore, score: 30 },
        energyDriftDbPerMin: { ...base.prosodyArc.energyDriftDbPerMin, score: 10 },
        paceVariabilityPct: { ...base.prosodyArc.paceVariabilityPct, score: 10 },
        withinSegmentPaceChangePct: { ...base.prosodyArc.withinSegmentPaceChangePct, score: 10 },
      },
      narrativeArc: {
        ...base.narrativeArc,
        segmentCohesionDrift: { ...base.narrativeArc.segmentCohesionDrift, score: 10 },
        timeToHookSeconds: { ...base.narrativeArc.timeToHookSeconds, score: 95 },
      },
      visualEditAlignment: {
        ...base.visualEditAlignment,
        audioVisualEmphasisAlignment: { ...base.visualEditAlignment.audioVisualEmphasisAlignment, score: 30 },
        beatsVsEditsAlignment: { ...base.visualEditAlignment.beatsVsEditsAlignment, score: 35 },
        silenceForEmphasisFidelity: { ...base.visualEditAlignment.silenceForEmphasisFidelity, score: 25 },
      },
      cognitiveLoad: {
        ...base.cognitiveLoad,
        loadPerSecond: { ...base.cognitiveLoad.loadPerSecond, score: 10 },
      },
    });

    expect(aligned.alignmentScore.score).toBeGreaterThan(drifty.alignmentScore.score);
    expect(aligned.timingScore.score).toBeGreaterThan(drifty.timingScore.score);
    expect(aligned.driftScore.score).toBeGreaterThan(drifty.driftScore.score);
  });
});
