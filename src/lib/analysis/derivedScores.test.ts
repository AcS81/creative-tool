import { describe, expect, it } from "vitest";
import type { CoreMetrics, SummaryMetric } from "./types/coreMetrics";
import { computeAlignmentScores, computeBalanceScores, computeCognitiveLoadScores, computeMetaAxes, computeSecondOrderScores } from "./derivedScores";
import { buildDefaultAdvancedMetrics } from "./fingerprint/defaults";
import type { ScoredMetric, TimelinePoint } from "../types";
import type { VideoSkeleton } from "./types/skeleton";

const metric = (score: number, observed = true): SummaryMetric => ({
  score,
  value: "value",
  observed,
});

const baseCoreMetrics = (): CoreMetrics => ({
  voice: {
    speakingRate: metric(60),
    fillerRate: metric(0),
    pauseUsage: metric(0),
    loudnessRange: metric(80),
    pitchVariation: metric(40),
    clarity: metric(50),
    warmth: metric(0),
  },
  language: {
    concreteness: metric(50),
    metaphorDensity: metric(70),
    references: metric(90),
    humor: metric(0),
    teachingVsRiffing: metric(0),
    storyPresence: metric(0),
  },
  narrative: {
    structureClarity: metric(70),
    hookPresence: metric(80),
    transitionQuality: metric(0),
    payoffDelivery: metric(90),
  },
  visual: {
    cutRate: metric(20),
    environmentStability: metric(70),
    movement: metric(40),
    expression: metric(60),
  },
  sound: {
    musicCoverage: metric(0),
    musicBalance: metric(90),
    sfxDensity: metric(0),
    silenceUsage: metric(0),
  },
});

const coreForAlignment = (): CoreMetrics => ({
  voice: {
    speakingRate: metric(70),
    fillerRate: metric(0),
    pauseUsage: metric(50),
    loudnessRange: metric(80),
    pitchVariation: metric(60),
    clarity: metric(0),
    warmth: metric(0),
  },
  language: {
    concreteness: metric(80),
    metaphorDensity: metric(0),
    references: metric(0),
    humor: metric(0),
    teachingVsRiffing: metric(0),
    storyPresence: metric(0),
  },
  narrative: {
    structureClarity: metric(90),
    hookPresence: metric(0),
    transitionQuality: metric(70),
    payoffDelivery: metric(0),
  },
  visual: {
    cutRate: metric(40),
    environmentStability: metric(0),
    movement: metric(50),
    expression: metric(60),
  },
  sound: {
    musicCoverage: metric(0),
    musicBalance: metric(0),
    sfxDensity: metric(0),
    silenceUsage: metric(0),
  },
});

const buildTimeline = (points: number, maxTime: number, value: number): TimelinePoint[] => {
  if (points <= 1) {
    return [{ timeSeconds: 0, value }];
  }
  return Array.from({ length: points }, (_, index) => ({
    timeSeconds: (maxTime / (points - 1)) * index,
    value,
  }));
};

const scoredMetric = (score: number, overrides: Partial<ScoredMetric> = {}): ScoredMetric => ({
  score,
  value: "value",
  observed: true,
  ...overrides,
});

const skeletonForBalance: VideoSkeleton = {
  durationSeconds: 600,
  videoType: "tutorial",
  topicSummary: "Balance test skeleton.",
  chapters: [],
  keyMoments: [],
  contentMix: {
    talkingHeadPct: 80,
    brollPct: 10,
    graphicsPct: 5,
    screencastPct: 5,
    otherPct: 0,
  },
  analysisHints: {
    hasMusic: false,
    hasSFX: false,
    hasOnScreenText: true,
    hasMultipleSpeakers: false,
    primaryLanguage: "en",
    estimatedComplexity: "medium",
  },
};

describe("computeMetaAxes", () => {
  it("computes averages and weighted scores from observed inputs", () => {
    const metaAxes = computeMetaAxes(baseCoreMetrics());

    expect(metaAxes.voiceIntensity.observed).toBe(true);
    expect(metaAxes.voiceIntensity.value).toBeCloseTo(60, 2);

    expect(metaAxes.conceptualDepth.observed).toBe(true);
    expect(metaAxes.conceptualDepth.value).toBeCloseTo(68, 2);

    expect(metaAxes.narrativeStructureStrength.observed).toBe(true);
    expect(metaAxes.narrativeStructureStrength.value).toBeCloseTo(80, 2);

    expect(metaAxes.visualDynamism.observed).toBe(true);
    expect(metaAxes.visualDynamism.value).toBeCloseTo(40, 2);

    expect(metaAxes.productionPolish.observed).toBe(true);
    expect(metaAxes.productionPolish.value).toBeCloseTo(70, 2);
  });

  it("marks axes unobserved when fewer than half of inputs are observed", () => {
    const core = baseCoreMetrics();
    core.voice.loudnessRange = metric(80, false);
    core.voice.pitchVariation = metric(40, false);

    const metaAxes = computeMetaAxes(core);

    expect(metaAxes.voiceIntensity.observed).toBe(false);
    expect(metaAxes.voiceIntensity.value).toBeCloseTo(60, 2);
  });

  it("renormalizes weighted inputs when some metrics are unobserved", () => {
    const core = baseCoreMetrics();
    core.language.references = metric(90, false);

    const metaAxes = computeMetaAxes(core);

    expect(metaAxes.conceptualDepth.observed).toBe(true);
    expect(metaAxes.conceptualDepth.value).toBeCloseTo(57.14, 2);
  });
});

describe("computeAlignmentScores", () => {
  it("blends advanced timelines with fallback heuristics", () => {
    const core = coreForAlignment();
    const advanced = buildDefaultAdvancedMetrics();

    advanced.visualEditAlignment.audioVisualEmphasisAlignment = scoredMetric(20, {
      timeline: buildTimeline(5, 40, 90),
    });
    advanced.visualEditAlignment.beatsVsEditsAlignment = scoredMetric(20, {
      timeline: buildTimeline(15, 60, 50),
    });
    advanced.visualEditAlignment.prosodyVsSemanticImportanceAlignment = scoredMetric(90, {
      items: [
        { phrase: "key idea", importanceScore: 0.9, stressed: true },
        { phrase: "main point", importanceScore: 0.8, stressed: true },
        { phrase: "takeaway", importanceScore: 0.7, stressed: false },
      ],
    });

    const scores = computeAlignmentScores(core, advanced);

    expect(scores.audioVisualAlignment.observed).toBe(true);
    expect(scores.audioVisualAlignment.value).toBeCloseTo(83.33, 2);
    expect(scores.beatsEditsAlignment.value).toBeCloseTo(50, 2);
    expect(scores.prosodySemanticAlignment.value).toBeCloseTo(78, 2);
    expect(scores.overallAlignment.value).toBeCloseTo(71.73, 2);
  });

  it("falls back to core metrics when advanced data is missing", () => {
    const core = coreForAlignment();

    const scores = computeAlignmentScores(core);

    expect(scores.audioVisualAlignment.observed).toBe(true);
    expect(scores.audioVisualAlignment.value).toBeCloseTo(80, 2);
    expect(scores.beatsEditsAlignment.value).toBeCloseTo(69, 2);
    expect(scores.prosodySemanticAlignment.value).toBeCloseTo(66, 2);
    expect(scores.overallAlignment.observed).toBe(true);
  });
});

describe("computeBalanceScores", () => {
  it("derives balance scores from mix and meta axes", () => {
    const core = baseCoreMetrics();
    const scores = computeBalanceScores(core, skeletonForBalance);

    expect(scores.overRelianceScore.observed).toBe(true);
    expect(scores.overRelianceScore.value).toBeCloseTo(47.2, 2);
    expect(scores.complementarityScore.value).toBeCloseTo(64.8, 2);
    expect(scores.redundancyScore.value).toBeCloseTo(57.28, 2);
    expect(scores.overallBalance.value).toBeCloseTo(56.28, 2);
  });
});

describe("computeCognitiveLoadScores", () => {
  it("uses advanced timelines when available", () => {
    const core = baseCoreMetrics();
    const advanced = buildDefaultAdvancedMetrics();
    advanced.cognitiveLoad.loadPerSecond = scoredMetric(0, {
      timeline: [
        { timeSeconds: 0, value: 20 },
        { timeSeconds: 10, value: 40 },
        { timeSeconds: 20, value: 60 },
        { timeSeconds: 30, value: 80 },
      ],
    });

    const scores = computeCognitiveLoadScores(core, advanced);

    expect(scores.averageLoad.value).toBeCloseTo(50, 2);
    expect(scores.peakLoad.value).toBeCloseTo(80, 2);
    expect(scores.loadVariance.value).toBeCloseTo(44.72, 2);
    expect(scores.overloadMoments.value).toBeCloseTo(25, 2);
  });

  it("falls back to core metrics when advanced data is missing", () => {
    const core = baseCoreMetrics();
    core.voice.speakingRate = metric(80);
    core.visual.cutRate = metric(60);
    core.language.metaphorDensity = metric(40);
    core.narrative.structureClarity = metric(20);
    core.voice.pauseUsage = metric(30);

    const scores = computeCognitiveLoadScores(core);

    expect(scores.averageLoad.value).toBeCloseTo(66, 2);
    expect(scores.peakLoad.value).toBeCloseTo(81, 2);
    expect(scores.loadVariance.value).toBeCloseTo(29.93, 2);
    expect(scores.overloadMoments.value).toBeCloseTo(37.5, 2);
  });
});

describe("computeSecondOrderScores", () => {
  it("prefers advanced second-order inputs when available", () => {
    const core = baseCoreMetrics();
    const advanced = buildDefaultAdvancedMetrics();
    advanced.prosodyArc.energyDriftDbPerMin = scoredMetric(80);
    advanced.prosodyArc.paceVariabilityPct = scoredMetric(60);
    advanced.narrativeArc.segmentCohesionDrift = scoredMetric(40);
    advanced.prosodyArc.withinSegmentPaceChangePct = scoredMetric(50);
    advanced.cognitiveLoad.loadPerSecond = scoredMetric(70);
    advanced.narrativeArc.timeToHookSeconds = scoredMetric(30);
    advanced.narrativeArc.hookStrengthScore = scoredMetric(70);
    advanced.visualEditAlignment.beatsVsEditsAlignment = scoredMetric(60);
    advanced.visualEditAlignment.silenceForEmphasisFidelity = scoredMetric(50);

    const alignment = computeAlignmentScores(core, advanced);
    const balance = computeBalanceScores(core, skeletonForBalance);
    const cognitiveLoad = computeCognitiveLoadScores(core, advanced);
    const scores = computeSecondOrderScores({
      core,
      alignment,
      balance,
      cognitiveLoad,
      advanced,
    });

    expect(scores.alignmentScore.value).toBeCloseTo(alignment.overallAlignment.value, 2);
    expect(scores.balanceScore.value).toBeCloseTo(balance.overallBalance.value, 2);
    expect(scores.driftScore.value).toBeCloseTo(59, 2);
    expect(scores.decayScore.value).toBeCloseTo(65, 2);
    expect(scores.timingScore.value).toBeCloseTo(66.25, 2);
  });
});
