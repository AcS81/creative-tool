export interface SummaryMetric {
  score: number; // 0-100
  value: string; // Human-readable summary, e.g., "145 wpm, moderate"
  observed: boolean; // False if couldn't measure
}

export interface CoreMetrics {
  voice: {
    speakingRate: SummaryMetric;
    fillerRate: SummaryMetric;
    pauseUsage: SummaryMetric;
    loudnessRange: SummaryMetric;
    pitchVariation: SummaryMetric;
    clarity: SummaryMetric;
    warmth: SummaryMetric;
  };
  language: {
    concreteness: SummaryMetric;
    metaphorDensity: SummaryMetric;
    references: SummaryMetric;
    humor: SummaryMetric;
    teachingVsRiffing: SummaryMetric;
    storyPresence: SummaryMetric;
  };
  narrative: {
    structureClarity: SummaryMetric;
    hookPresence: SummaryMetric;
    transitionQuality: SummaryMetric;
    payoffDelivery: SummaryMetric;
  };
  visual: {
    cutRate: SummaryMetric;
    environmentStability: SummaryMetric;
    movement: SummaryMetric;
    expression: SummaryMetric;
  };
  sound: {
    musicCoverage: SummaryMetric;
    musicBalance: SummaryMetric;
    sfxDensity: SummaryMetric;
    silenceUsage: SummaryMetric;
  };
}

export interface ChapterCoreMetrics extends CoreMetrics {
  chapterId: string;
}
