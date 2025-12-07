export type GeminiObservedMetric = {
  score: number; // 0–100 normalized score
  value: string; // raw measurement or "unobserved"
  explanation: string; // short description
};

export type GeminiBeat = {
  label: string;
  start: number;
  end: number;
};

export interface GeminiVoiceMetrics {
  speaking_rate: GeminiObservedMetric;
  filler_rate: GeminiObservedMetric;
  pauses: GeminiObservedMetric;
  loudness_range: GeminiObservedMetric;
  pitch_variation: GeminiObservedMetric;
  clarity: GeminiObservedMetric;
  warmth: GeminiObservedMetric;
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
  story_presence: GeminiObservedMetric;
  devices?: Array<{
    type: string;
    timestamp: number;
  }>;
}

export interface GeminiVisualEditSoundMetrics {
  environment_stability: GeminiObservedMetric;
  talking_vs_broll_vs_graphics: GeminiObservedMetric;
  movement: GeminiObservedMetric;
  expression: GeminiObservedMetric;
  cut_rate: GeminiObservedMetric;
  pattern_interrupts: GeminiObservedMetric;
  broll_coverage: GeminiObservedMetric;
  music_coverage: GeminiObservedMetric;
  music_changes: GeminiObservedMetric;
  music_balance: GeminiObservedMetric;
  sfx_density: GeminiObservedMetric;
  silence_for_emphasis: GeminiObservedMetric;
}

export interface GeminiMultimodalResponse {
  voice: GeminiVoiceMetrics;
  language: GeminiLanguageMetrics;
  narrative: GeminiNarrativeMetrics;
  visual_edit_sound: GeminiVisualEditSoundMetrics;
}
