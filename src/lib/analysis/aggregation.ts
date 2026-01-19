import type { ChapterCoreMetrics, CoreMetrics, SummaryMetric } from "./types/coreMetrics";
import type { VideoSkeleton } from "./types/skeleton";

type WeightedMetricInput = {
  metric: SummaryMetric;
  weight: number;
};

const buildUnobservedMetric = (): SummaryMetric => ({
  score: 0,
  value: "unobserved",
  observed: false,
});

export const buildUnobservedCoreMetrics = (): CoreMetrics => ({
  voice: {
    speakingRate: buildUnobservedMetric(),
    fillerRate: buildUnobservedMetric(),
    pauseUsage: buildUnobservedMetric(),
    loudnessRange: buildUnobservedMetric(),
    pitchVariation: buildUnobservedMetric(),
    clarity: buildUnobservedMetric(),
    warmth: buildUnobservedMetric(),
  },
  language: {
    concreteness: buildUnobservedMetric(),
    metaphorDensity: buildUnobservedMetric(),
    references: buildUnobservedMetric(),
    humor: buildUnobservedMetric(),
    teachingVsRiffing: buildUnobservedMetric(),
    storyPresence: buildUnobservedMetric(),
  },
  narrative: {
    structureClarity: buildUnobservedMetric(),
    hookPresence: buildUnobservedMetric(),
    transitionQuality: buildUnobservedMetric(),
    payoffDelivery: buildUnobservedMetric(),
  },
  visual: {
    cutRate: buildUnobservedMetric(),
    environmentStability: buildUnobservedMetric(),
    movement: buildUnobservedMetric(),
    expression: buildUnobservedMetric(),
  },
  sound: {
    musicCoverage: buildUnobservedMetric(),
    musicBalance: buildUnobservedMetric(),
    sfxDensity: buildUnobservedMetric(),
    silenceUsage: buildUnobservedMetric(),
  },
});

export const buildFallbackCoreMetrics = (_skeleton?: VideoSkeleton): CoreMetrics => buildUnobservedCoreMetrics();

const isObservedValue = (value: string) => value.trim() !== "" && value.trim().toLowerCase() !== "unobserved";

const aggregateSummaryMetric = (inputs: WeightedMetricInput[]): SummaryMetric => {
  if (inputs.length === 0) return buildUnobservedMetric();

  const totalWeight = inputs.reduce((sum, entry) => sum + entry.weight, 0);
  const observedInputs = inputs.filter(
    (entry) => entry.metric.observed && isObservedValue(entry.metric.value),
  );
  const observedWeight = observedInputs.reduce((sum, entry) => sum + entry.weight, 0);
  const observedMajority = observedWeight >= totalWeight / 2;

  if (!observedMajority || observedInputs.length === 0) {
    return buildUnobservedMetric();
  }

  const weightedScore =
    observedInputs.reduce((sum, entry) => sum + entry.metric.score * entry.weight, 0) / observedWeight;

  const sortedByWeight = [...observedInputs].sort((a, b) => b.weight - a.weight);
  const value = sortedByWeight.find((entry) => isObservedValue(entry.metric.value))?.metric.value ?? "unobserved";

  return {
    score: weightedScore,
    value,
    observed: true,
  };
};

const buildWeightMap = (skeleton: VideoSkeleton) => {
  const weights = new Map<string, number>();
  for (const chapter of skeleton.chapters) {
    const duration = Math.max(0, chapter.endSeconds - chapter.startSeconds);
    weights.set(chapter.id, duration > 0 ? duration : 1);
  }
  return weights;
};

const resolveDefaultWeight = (weights: Map<string, number>) => {
  const values = [...weights.values()].filter((value) => value > 0);
  if (values.length === 0) return 1;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
};

const weightForChapter = (weights: Map<string, number>, defaultWeight: number, chapterId: string) => {
  const weight = weights.get(chapterId);
  if (weight !== undefined && weight > 0) return weight;
  return defaultWeight;
};

export const aggregateCoreMetrics = (
  chapters: ChapterCoreMetrics[],
  skeleton: VideoSkeleton,
): CoreMetrics => {
  if (chapters.length === 0) return buildUnobservedCoreMetrics();

  const weights = buildWeightMap(skeleton);
  const defaultWeight = resolveDefaultWeight(weights);
  const weighted = (metric: SummaryMetric, chapterId: string): WeightedMetricInput => ({
    metric,
    weight: weightForChapter(weights, defaultWeight, chapterId),
  });

  return {
    voice: {
      speakingRate: aggregateSummaryMetric(chapters.map((ch) => weighted(ch.voice.speakingRate, ch.chapterId))),
      fillerRate: aggregateSummaryMetric(chapters.map((ch) => weighted(ch.voice.fillerRate, ch.chapterId))),
      pauseUsage: aggregateSummaryMetric(chapters.map((ch) => weighted(ch.voice.pauseUsage, ch.chapterId))),
      loudnessRange: aggregateSummaryMetric(chapters.map((ch) => weighted(ch.voice.loudnessRange, ch.chapterId))),
      pitchVariation: aggregateSummaryMetric(chapters.map((ch) => weighted(ch.voice.pitchVariation, ch.chapterId))),
      clarity: aggregateSummaryMetric(chapters.map((ch) => weighted(ch.voice.clarity, ch.chapterId))),
      warmth: aggregateSummaryMetric(chapters.map((ch) => weighted(ch.voice.warmth, ch.chapterId))),
    },
    language: {
      concreteness: aggregateSummaryMetric(chapters.map((ch) => weighted(ch.language.concreteness, ch.chapterId))),
      metaphorDensity: aggregateSummaryMetric(
        chapters.map((ch) => weighted(ch.language.metaphorDensity, ch.chapterId)),
      ),
      references: aggregateSummaryMetric(chapters.map((ch) => weighted(ch.language.references, ch.chapterId))),
      humor: aggregateSummaryMetric(chapters.map((ch) => weighted(ch.language.humor, ch.chapterId))),
      teachingVsRiffing: aggregateSummaryMetric(
        chapters.map((ch) => weighted(ch.language.teachingVsRiffing, ch.chapterId)),
      ),
      storyPresence: aggregateSummaryMetric(chapters.map((ch) => weighted(ch.language.storyPresence, ch.chapterId))),
    },
    narrative: {
      structureClarity: aggregateSummaryMetric(
        chapters.map((ch) => weighted(ch.narrative.structureClarity, ch.chapterId)),
      ),
      hookPresence: aggregateSummaryMetric(chapters.map((ch) => weighted(ch.narrative.hookPresence, ch.chapterId))),
      transitionQuality: aggregateSummaryMetric(
        chapters.map((ch) => weighted(ch.narrative.transitionQuality, ch.chapterId)),
      ),
      payoffDelivery: aggregateSummaryMetric(
        chapters.map((ch) => weighted(ch.narrative.payoffDelivery, ch.chapterId)),
      ),
    },
    visual: {
      cutRate: aggregateSummaryMetric(chapters.map((ch) => weighted(ch.visual.cutRate, ch.chapterId))),
      environmentStability: aggregateSummaryMetric(
        chapters.map((ch) => weighted(ch.visual.environmentStability, ch.chapterId)),
      ),
      movement: aggregateSummaryMetric(chapters.map((ch) => weighted(ch.visual.movement, ch.chapterId))),
      expression: aggregateSummaryMetric(chapters.map((ch) => weighted(ch.visual.expression, ch.chapterId))),
    },
    sound: {
      musicCoverage: aggregateSummaryMetric(chapters.map((ch) => weighted(ch.sound.musicCoverage, ch.chapterId))),
      musicBalance: aggregateSummaryMetric(chapters.map((ch) => weighted(ch.sound.musicBalance, ch.chapterId))),
      sfxDensity: aggregateSummaryMetric(chapters.map((ch) => weighted(ch.sound.sfxDensity, ch.chapterId))),
      silenceUsage: aggregateSummaryMetric(chapters.map((ch) => weighted(ch.sound.silenceUsage, ch.chapterId))),
    },
  };
};
