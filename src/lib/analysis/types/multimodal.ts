export type GeminiObservedMetric = {
  score: number; // 0–100 normalized score
  value: string; // raw measurement or "unobserved"
  explanation: string; // short description
};

export type GeminiTimelinePoint = {
  timeSeconds: number;
  value: number;
  label?: string;
};

export type GeminiSpan = {
  startSeconds: number;
  endSeconds: number;
  value?: number;
  label?: string;
  alignedBeat?: string;
  alignedPunchline?: boolean;
};

export type GeminiSegmentDelta = {
  startSeconds: number;
  endSeconds: number;
  deltaPct?: number;
  label?: string;
};

export type GeminiRichMetric = GeminiObservedMetric & {
  observed?: boolean;
  timeline?: GeminiTimelinePoint[];
  spans?: GeminiSpan[];
  segments?: GeminiSegmentDelta[];
  items?: Array<Record<string, unknown>>;
  proportions?: Record<string, number>;
  counts?: Record<string, number>;
  trend?: number;
};

export type GeminiBeat = {
  label: string;
  start: number;
  end: number;
  role?: string;
};

export interface GeminiVoiceMetrics {
  speaking_rate: GeminiObservedMetric;
  filler_rate: GeminiObservedMetric;
  pauses: GeminiObservedMetric;
  loudness_range: GeminiObservedMetric;
  pitch_variation: GeminiObservedMetric;
}

export interface GeminiLanguageMetrics {
  concreteness: GeminiObservedMetric;
  metaphor_density: GeminiObservedMetric;
  references: GeminiObservedMetric;
  humor: GeminiObservedMetric;
  teaching_vs_riffing: GeminiObservedMetric;
}

export interface GeminiNarrativeMetrics {
  beats: GeminiBeat[];
  mini_arc_density: GeminiObservedMetric;
  foreshadow_callbacks: GeminiObservedMetric;
  transition_clarity: GeminiObservedMetric;
  story_presence?: GeminiObservedMetric;
  devices?: Array<{
    type: string;
    timestamp: number;
  }>;
}

export interface GeminiVisualEditSoundMetrics {
  environment_stability: GeminiObservedMetric;
  talking_vs_broll_vs_graphics: GeminiObservedMetric;
  cut_rate: GeminiObservedMetric;
  pattern_interrupts: GeminiObservedMetric;
  broll_coverage: GeminiObservedMetric;
  music_coverage: GeminiObservedMetric;
  music_changes: GeminiObservedMetric;
  sfx_density: GeminiObservedMetric;
  silence_for_emphasis: GeminiObservedMetric;
}

export interface GeminiAdvancedProsodyArc {
  paceMeanWpm: GeminiRichMetric;
  paceVariabilityPct: GeminiRichMetric;
  withinSegmentPaceChangePct: GeminiRichMetric;
  emphasisAlignmentScore: GeminiRichMetric;
  energyDriftDbPerMin: GeminiRichMetric;
}

export interface GeminiAdvancedLanguageTexture {
  analogyExampleDefinitionRatio: GeminiRichMetric;
  sentenceCompressionRatio: GeminiRichMetric;
  humorTimingScore: GeminiRichMetric;
  referenceDensityPerMin: GeminiRichMetric;
  questionRate: GeminiRichMetric;
}

export interface GeminiAdvancedNarrativeArc {
  timeToHookSeconds: GeminiRichMetric;
  hookStrengthScore: GeminiRichMetric;
  segmentCohesionDrift: GeminiRichMetric;
  openLoopsUnresolvedRatio: GeminiRichMetric;
  endingResolutionScore: GeminiRichMetric;
}

export interface GeminiAdvancedVisualEditAlignment {
  visualEntropy: GeminiRichMetric;
  cutRateRefinement: GeminiRichMetric;
  silenceForEmphasisFidelity: GeminiRichMetric;
  audioVisualEmphasisAlignment: GeminiRichMetric;
  beatsVsEditsAlignment: GeminiRichMetric;
  prosodyVsSemanticImportanceAlignment: GeminiRichMetric;
}

export interface GeminiAdvancedModalityBalance {
  redundancyVsComplementarity: GeminiRichMetric;
  modalityOverReliance: GeminiRichMetric;
}

export interface GeminiAdvancedCognitiveLoad {
  loadPerSecond: GeminiRichMetric;
  loadHighlights: GeminiRichMetric;
}

export interface GeminiAdvancedSecondOrder {
  alignmentScore: GeminiRichMetric;
  driftScore: GeminiRichMetric;
  decayScore: GeminiRichMetric;
  balanceScore: GeminiRichMetric;
  timingScore: GeminiRichMetric;
}

export interface GeminiAdvancedMetrics {
  prosodyArc: GeminiAdvancedProsodyArc;
  languageTexture: GeminiAdvancedLanguageTexture;
  narrativeArc: GeminiAdvancedNarrativeArc;
  visualEditAlignment: GeminiAdvancedVisualEditAlignment;
  modalityBalance: GeminiAdvancedModalityBalance;
  cognitiveLoad: GeminiAdvancedCognitiveLoad;
  secondOrder: GeminiAdvancedSecondOrder;
}

export interface GeminiMultimodalResponse {
  voice: GeminiVoiceMetrics;
  language: GeminiLanguageMetrics;
  narrative: GeminiNarrativeMetrics;
  visual_edit_sound: GeminiVisualEditSoundMetrics;
  advanced_metrics?: GeminiAdvancedMetrics;
}
