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
} as const;

export const SECOND_ORDER_METRICS = [
  "alignmentScore",
  "driftScore",
  "decayScore",
  "balanceScore",
  "timingScore",
] as const;

export const SUPPLEMENTAL_METRICS = {
  voice: ["warmth"],
  language: ["sentiment", "directive_density", "self_disclosure", "sarcasm_irony"],
} as const;

export type MetricTier = 1 | 2 | 3;

export type MetricDefinition = {
  id: string;
  domain: string;
  tier: MetricTier;
  hasTimeline: boolean;
  requiresTimeline: boolean;
};

const buildMetric = (
  id: string,
  domain: string,
  tier: MetricTier,
  hasTimeline = false,
  requiresTimeline = false,
): MetricDefinition => ({
  id,
  domain,
  tier,
  hasTimeline,
  requiresTimeline,
});

export const METRIC_REGISTRY: Record<string, MetricDefinition> = {
  // Tier 1: Core metrics
  speaking_rate: buildMetric("speaking_rate", "voice", 1),
  filler_rate: buildMetric("filler_rate", "voice", 1),
  pauses: buildMetric("pauses", "voice", 1),
  loudness_range: buildMetric("loudness_range", "voice", 1),
  pitch_variation: buildMetric("pitch_variation", "voice", 1),

  concreteness: buildMetric("concreteness", "language", 1),
  metaphor_density: buildMetric("metaphor_density", "language", 1),
  references: buildMetric("references", "language", 1),
  humor: buildMetric("humor", "language", 1),
  teaching_vs_riffing: buildMetric("teaching_vs_riffing", "language", 1),

  mini_arc_density: buildMetric("mini_arc_density", "narrative", 1),
  foreshadow_callbacks: buildMetric("foreshadow_callbacks", "narrative", 1),
  transition_clarity: buildMetric("transition_clarity", "narrative", 1),
  story_presence: buildMetric("story_presence", "narrative", 1),

  environment_stability: buildMetric("environment_stability", "visual", 1),
  talking_vs_broll_vs_graphics: buildMetric("talking_vs_broll_vs_graphics", "visual", 1),
  cut_rate: buildMetric("cut_rate", "editing", 1),
  pattern_interrupts: buildMetric("pattern_interrupts", "editing", 1),
  broll_coverage: buildMetric("broll_coverage", "editing", 1),
  music_coverage: buildMetric("music_coverage", "sound", 1),
  music_changes: buildMetric("music_changes", "sound", 1),
  sfx_density: buildMetric("sfx_density", "sound", 1),
  silence_for_emphasis: buildMetric("silence_for_emphasis", "sound", 1),

  // Tier 2: Advanced metrics
  paceMeanWpm: buildMetric("paceMeanWpm", "voice", 2, true, true),
  paceVariabilityPct: buildMetric("paceVariabilityPct", "voice", 2, true, true),
  withinSegmentPaceChangePct: buildMetric("withinSegmentPaceChangePct", "voice", 2),
  emphasisAlignmentScore: buildMetric("emphasisAlignmentScore", "voice", 2),
  energyDriftDbPerMin: buildMetric("energyDriftDbPerMin", "voice", 2, true, true),

  analogyExampleDefinitionRatio: buildMetric("analogyExampleDefinitionRatio", "language", 2),
  sentenceCompressionRatio: buildMetric("sentenceCompressionRatio", "language", 2, true, false),
  humorTimingScore: buildMetric("humorTimingScore", "language", 2),
  referenceDensityPerMin: buildMetric("referenceDensityPerMin", "language", 2),
  questionRate: buildMetric("questionRate", "language", 2, true, false),
  audienceAddressFrequency: buildMetric("audienceAddressFrequency", "language", 2, true, false),

  timeToHookSeconds: buildMetric("timeToHookSeconds", "narrative", 2),
  hookStrengthScore: buildMetric("hookStrengthScore", "narrative", 2),
  segmentCohesionDrift: buildMetric("segmentCohesionDrift", "narrative", 2, true, true),
  openLoopsUnresolvedRatio: buildMetric("openLoopsUnresolvedRatio", "narrative", 2),
  endingResolutionScore: buildMetric("endingResolutionScore", "narrative", 2),

  visualEntropy: buildMetric("visualEntropy", "visual", 2, true, true),
  cutRateRefinement: buildMetric("cutRateRefinement", "editing", 2),
  silenceForEmphasisFidelity: buildMetric("silenceForEmphasisFidelity", "sound", 2),
  audioVisualEmphasisAlignment: buildMetric("audioVisualEmphasisAlignment", "meta", 2, true, true),
  beatsVsEditsAlignment: buildMetric("beatsVsEditsAlignment", "meta", 2, true, true),
  prosodyVsSemanticImportanceAlignment: buildMetric(
    "prosodyVsSemanticImportanceAlignment",
    "meta",
    2,
  ),

  redundancyVsComplementarity: buildMetric("redundancyVsComplementarity", "meta", 2),
  modalityOverReliance: buildMetric("modalityOverReliance", "meta", 2),
  loadPerSecond: buildMetric("loadPerSecond", "meta", 2, true, true),
  loadHighlights: buildMetric("loadHighlights", "meta", 2),

  warmth: buildMetric("warmth", "voice", 2),
  sentiment: buildMetric("sentiment", "language", 2),
  directive_density: buildMetric("directive_density", "language", 2),
  self_disclosure: buildMetric("self_disclosure", "language", 2),
  sarcasm_irony: buildMetric("sarcasm_irony", "language", 2),

  // Tier 3: Derived metrics
  voiceIntensity: buildMetric("voiceIntensity", "meta", 3),
  conceptualDepth: buildMetric("conceptualDepth", "meta", 3),
  narrativeStructureStrength: buildMetric("narrativeStructureStrength", "meta", 3),
  visualDynamism: buildMetric("visualDynamism", "meta", 3),
  productionPolish: buildMetric("productionPolish", "meta", 3),

  alignmentScore: buildMetric("alignmentScore", "meta", 3),
  driftScore: buildMetric("driftScore", "meta", 3),
  decayScore: buildMetric("decayScore", "meta", 3),
  balanceScore: buildMetric("balanceScore", "meta", 3),
  timingScore: buildMetric("timingScore", "meta", 3),
};

const metricList = Object.values(METRIC_REGISTRY);

const getMetricsByTier = (tier: MetricTier) => metricList.filter((metric) => metric.tier === tier);

export const getTier1Metrics = (): MetricDefinition[] => getMetricsByTier(1);

export const getTier2Metrics = (): MetricDefinition[] => getMetricsByTier(2);

export const getDerivedMetrics = (): MetricDefinition[] => getMetricsByTier(3);

export const getMetricsByDomain = (domain: string): MetricDefinition[] =>
  metricList.filter((metric) => metric.domain === domain);

export type BaseDomainKey = keyof typeof BASE_DOMAIN_METRICS;
export type AdvancedSectionKey = keyof typeof ADVANCED_METRIC_SECTIONS;
export type SupplementalDomainKey = keyof typeof SUPPLEMENTAL_METRICS;
