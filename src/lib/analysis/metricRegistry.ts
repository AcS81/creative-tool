export const BASE_DOMAIN_METRICS = {
  voice: ["speaking_rate", "filler_rate", "pauses", "loudness_range", "pitch_variation"],
  language: ["concreteness", "metaphor_density", "references", "humor", "teaching_vs_riffing"],
  narrative: ["mini_arc_density", "foreshadow_callbacks", "transition_clarity", "story_presence"],
  visual_edit_sound: [
    "environment_stability",
    "talking_vs_broll_vs_graphics",
    "cut_rate",
    "pattern_interrupts",
    "broll_coverage",
    "music_coverage",
    "music_changes",
    "sfx_density",
    "silence_for_emphasis",
  ],
} as const;

export const ADVANCED_METRIC_SECTIONS = {
  prosodyArc: [
    "paceMeanWpm",
    "paceVariabilityPct",
    "withinSegmentPaceChangePct",
    "emphasisAlignmentScore",
    "energyDriftDbPerMin",
  ],
  languageTexture: [
    "analogyExampleDefinitionRatio",
    "sentenceCompressionRatio",
    "humorTimingScore",
    "referenceDensityPerMin",
    "questionRate",
    "audienceAddressFrequency",
  ],
  narrativeArc: [
    "timeToHookSeconds",
    "hookStrengthScore",
    "segmentCohesionDrift",
    "openLoopsUnresolvedRatio",
    "endingResolutionScore",
  ],
  visualEditAlignment: [
    "visualEntropy",
    "cutRateRefinement",
    "silenceForEmphasisFidelity",
    "audioVisualEmphasisAlignment",
    "beatsVsEditsAlignment",
    "prosodyVsSemanticImportanceAlignment",
  ],
  modalityBalance: ["redundancyVsComplementarity", "modalityOverReliance"],
  cognitiveLoad: ["loadPerSecond", "loadHighlights"],
  secondOrder: ["alignmentScore", "driftScore", "decayScore", "balanceScore", "timingScore"],
} as const;

export const SUPPLEMENTAL_METRICS = {
  voice: ["warmth"],
  language: ["sentiment", "directive_density", "self_disclosure", "sarcasm_irony"],
} as const;

export type BaseDomainKey = keyof typeof BASE_DOMAIN_METRICS;
export type AdvancedSectionKey = keyof typeof ADVANCED_METRIC_SECTIONS;
export type SupplementalDomainKey = keyof typeof SUPPLEMENTAL_METRICS;
