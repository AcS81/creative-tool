import type { AdvancedFingerprintMetrics, ScoredMetric } from "../../types";

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export const hashStringToNumber = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const deriveScore = (seed: number, salt: number) =>
  clamp(((seed + salt * 9973) % 101) + (salt % 7) - 3);

const makeTimeline = (base: number): ScoredMetric["timeline"] => [
  { timeSeconds: 5, value: clamp(base - 6) },
  { timeSeconds: 30, value: clamp(base) },
  { timeSeconds: 55, value: clamp(base + 6) },
];

const makeSpans = (base: number): NonNullable<ScoredMetric["spans"]> => [
  { startSeconds: 12, endSeconds: 13.2, value: clamp(base - 4), label: "reset", alignedBeat: "hook" },
  {
    startSeconds: 48,
    endSeconds: 49.4,
    value: clamp(base + 3),
    label: "punch",
    alignedBeat: "payoff",
    alignedPunchline: true,
  },
];

const makeSegments = (base: number): NonNullable<ScoredMetric["segments"]> => [
  { startSeconds: 0, endSeconds: 30, deltaPct: Math.round((base % 20) - 10) },
  { startSeconds: 30, endSeconds: 60, deltaPct: Math.round((base % 15) - 7) },
];

const metric = (score: number, value: string, extras: Partial<ScoredMetric> = {}): ScoredMetric => ({
  score: clamp(score),
  value,
  observed: true,
  ...extras,
});

export const buildMockAdvancedMetrics = (seed: number): AdvancedFingerprintMetrics => {
  const p1 = deriveScore(seed, 21);
  const p2 = deriveScore(seed, 22);
  const p3 = deriveScore(seed, 23);
  const l1 = deriveScore(seed, 24);
  const l2 = deriveScore(seed, 25);
  const n1 = deriveScore(seed, 26);
  const v1 = deriveScore(seed, 27);
  const c1 = deriveScore(seed, 28);

  const prosodyArc: AdvancedFingerprintMetrics["prosodyArc"] = {
    paceMeanWpm: metric(p1, `${130 + (p1 % 50)} wpm`, { timeline: makeTimeline(p1) }),
    paceVariabilityPct: metric(p2, `${8 + (p2 % 20)}% swing`, { timeline: makeTimeline(p2) }),
    withinSegmentPaceChangePct: metric(p3, `${(p3 % 18) - 9}% drift`, { segments: makeSegments(p3) }),
    emphasisAlignmentScore: metric(deriveScore(seed, 29), "stress vs key phrases", {
      items: [{ phrase: "key idea", stressed: true }],
    }),
    energyDriftDbPerMin: metric(deriveScore(seed, 30), `${(deriveScore(seed, 30) % 8) - 4} dB/min`, {
      trend: ((deriveScore(seed, 30) % 8) - 4) / 4,
    }),
  };

  const languageTexture: AdvancedFingerprintMetrics["languageTexture"] = {
    analogyExampleDefinitionRatio: metric(l1, "balance of examples/analogies/definitions", {
      counts: { analogies: (l1 % 3) + 1, examples: (l1 % 4) + 2, definitions: (l1 % 2) + 1 },
    }),
    sentenceCompressionRatio: metric(l2, `${10 + (l2 % 8)} words/idea`),
    humorTimingScore: metric(deriveScore(seed, 31), "setup/punch spacing", {
      items: [{ setupStart: 12, punchStart: 15, deltaSeconds: 3, landed: true }],
    }),
    referenceDensityPerMin: metric(deriveScore(seed, 32), `${(deriveScore(seed, 32) % 5) + 1} refs/min`, {
      counts: { cultural: (seed % 3) + 1, topical: (seed % 2) + 1 },
    }),
    questionRate: metric(deriveScore(seed, 33), `${(deriveScore(seed, 33) % 6) + 1} q/min`, {
      counts: { rhetorical: (seed % 3) + 1, genuine: (seed % 2) + 1 },
    }),
  };

  const narrativeArc: AdvancedFingerprintMetrics["narrativeArc"] = {
    timeToHookSeconds: metric(n1, `${5 + (seed % 12)}s`),
    hookStrengthScore: metric(deriveScore(seed, 34), "clear promise", {
      items: [{ beatTime: 6, devices: ["contrast"], promiseClarity: "high" }],
    }),
    segmentCohesionDrift: metric(deriveScore(seed, 35), "segment similarity drift", { timeline: makeTimeline(n1) }),
    openLoopsUnresolvedRatio: metric(deriveScore(seed, 36), `${(seed % 3)}/4 open loops closed`, {
      items: [{ openedAt: 10, resolvedAt: 70, label: "mystery" }],
    }),
    endingResolutionScore: metric(deriveScore(seed, 37), "clean resolution", {
      items: [{ payoffDelivered: true, ctaClarity: "explicit", callbackCount: 2 }],
    }),
  };

  const visualEditAlignment: AdvancedFingerprintMetrics["visualEditAlignment"] = {
    visualEntropy: metric(v1, "visual change rate", { timeline: makeTimeline(v1) }),
    cutRateRefinement: metric(deriveScore(seed, 38), `${1 + (seed % 4)}.${seed % 10}s median`, {
      items: [{ medianShotSeconds: 2.4, variance: 0.8 }],
    }),
    silenceForEmphasisFidelity: metric(deriveScore(seed, 39), "silence alignment", { spans: makeSpans(v1) }),
    audioVisualEmphasisAlignment: metric(deriveScore(seed, 40), "audio/visual peaks aligned", { timeline: makeTimeline(v1) }),
    beatsVsEditsAlignment: metric(deriveScore(seed, 41), "edits reinforce beats", { timeline: makeTimeline(n1) }),
    prosodyVsSemanticImportanceAlignment: metric(deriveScore(seed, 42), "prosody matches key ideas", {
      items: [{ phrase: "core insight", importanceScore: 0.8, stressed: true }],
    }),
  };

  const modalityBalance: AdvancedFingerprintMetrics["modalityBalance"] = {
    redundancyVsComplementarity: metric(deriveScore(seed, 43), "complementary mix", {
      proportions: { redundantPct: 0.25, complementaryPct: 0.65, conflictingPct: 0.1 },
    }),
    modalityOverReliance: metric(deriveScore(seed, 44), "voice-led", {
      proportions: { voicePct: 0.6, visualPct: 0.3, textPct: 0.1 },
    }),
  };

  const cognitiveLoad: AdvancedFingerprintMetrics["cognitiveLoad"] = {
    loadPerSecond: metric(c1, "momentary load", {
      timeline: [
        { timeSeconds: 0, value: clamp(c1 - 10) },
        { timeSeconds: 20, value: clamp(c1) },
        { timeSeconds: 40, value: clamp(c1 + 8) },
        { timeSeconds: 60, value: clamp(c1 - 4) },
      ],
    }),
    loadHighlights: metric(deriveScore(seed, 45), "load spikes", {
      spans: [
        { startSeconds: 18, endSeconds: 22, value: clamp(c1 + 10), label: "dense explainer" },
        { startSeconds: 48, endSeconds: 52, value: clamp(c1 + 6), label: "rapid cuts" },
      ],
    }),
  };

  const average = (...values: number[]) => values.reduce((sum, v) => sum + v, 0) / Math.max(values.length, 1);

  const alignmentScore = average(
    prosodyArc.emphasisAlignmentScore.score,
    visualEditAlignment.audioVisualEmphasisAlignment.score,
    visualEditAlignment.beatsVsEditsAlignment.score,
    visualEditAlignment.prosodyVsSemanticImportanceAlignment.score,
  );
  const driftScore = average(
    prosodyArc.energyDriftDbPerMin.score,
    prosodyArc.paceVariabilityPct.score,
    narrativeArc.segmentCohesionDrift.score,
  );
  const decayScore = average(
    prosodyArc.withinSegmentPaceChangePct.score,
    prosodyArc.energyDriftDbPerMin.score,
    cognitiveLoad.loadPerSecond.score,
  );
  const balanceScore = average(
    modalityBalance.redundancyVsComplementarity.score,
    clamp(100 - modalityBalance.modalityOverReliance.score),
  );
  const timingScore = average(
    clamp(100 - narrativeArc.timeToHookSeconds.score / 2),
    narrativeArc.hookStrengthScore.score,
    visualEditAlignment.beatsVsEditsAlignment.score,
    visualEditAlignment.silenceForEmphasisFidelity.score,
  );

  const secondOrder: AdvancedFingerprintMetrics["secondOrder"] = {
    alignmentScore: metric(alignmentScore, "alignment summary"),
    driftScore: metric(driftScore, "drift summary"),
    decayScore: metric(decayScore, "decay summary"),
    balanceScore: metric(balanceScore, "balance summary"),
    timingScore: metric(timingScore, "timing summary"),
  };

  return {
    prosodyArc,
    languageTexture,
    narrativeArc,
    visualEditAlignment,
    modalityBalance,
    cognitiveLoad,
    secondOrder,
  };
};
