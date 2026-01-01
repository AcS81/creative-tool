import type { AppConfig } from "../config";
import type {
  AdvancedFingerprintMetrics,
  AxisDetail,
  BeatRole,
  BeatSegment,
  DomainProfile,
  ScoredMetric,
} from "../types";
import {
  callGeminiMultimodalJson,
  GeminiApiError,
  type GeminiMultimodalErrorCode,
  type GeminiRequestMetrics,
  type GeminiMultimodalResult,
  type GeminiUsage,
} from "../gemini/client";
import type {
  GeminiAdvancedMetricsPartial,
  GeminiMultimodalResponse,
  GeminiObservedMetric,
  GeminiRichMetric,
} from "./types/multimodal";
import { parseGeminiAdvancedMetricsJson, parseGeminiMultimodalJson } from "./validators/geminiMultimodal";
import type { DomainKey } from "../archetypes/descriptions";
import { resolveAxisMetadata } from "./axisMetadata";
import { buildDefaultAdvancedMetrics } from "./fingerprint/defaults";
import { computeSecondOrderScores } from "./fingerprint/secondOrder";
import {
  ADVANCED_METRIC_SECTIONS,
  BASE_DOMAIN_METRICS,
  SECOND_ORDER_METRICS,
  type AdvancedSectionKey,
} from "./metricRegistry";

type MultimodalProfiles = {
  voice: DomainProfile;
  language: DomainProfile;
  narrative: DomainProfile;
  visual: DomainProfile;
  editing: DomainProfile;
  sound: DomainProfile;
};

export type MultimodalAnalysisResult = {
  profiles: MultimodalProfiles;
  beats?: BeatSegment[];
  axisDetails: Record<string, AxisDetail>;
  advancedMetrics?: AdvancedFingerprintMetrics;
  diagnostics: {
    unobservedCounts: Record<string, number>;
    coverage?: CoverageDiagnostics;
    salvage?: SalvageDiagnostics;
    rawStatus?: number;
    passMetrics?: PassMetricsDiagnostics;
  };
};

type PassMetricsTotals = {
  durationMs: number;
  attempts: number;
  retries: number;
  usage?: GeminiUsage;
  estimatedCostUsd?: number;
};

type PassMetricsDiagnostics = {
  core?: GeminiRequestMetrics;
  advancedAudioText?: GeminiRequestMetrics;
  advancedVisualCross?: GeminiRequestMetrics;
  salvage?: Record<string, GeminiRequestMetrics>;
  totals?: PassMetricsTotals;
};

type CoverageStat = {
  observed: number;
  total: number;
  missing: string[];
  observedPct: number;
  available: boolean;
};

type CoverageDiagnostics = {
  core: {
    voice: CoverageStat;
    language: CoverageStat;
    narrative: CoverageStat;
    visual_edit_sound: CoverageStat;
  };
  advanced?: {
    prosodyArc: CoverageStat;
    languageTexture: CoverageStat;
    narrativeArc: CoverageStat;
    visualEditAlignment: CoverageStat;
    modalityBalance: CoverageStat;
    cognitiveLoad: CoverageStat;
    secondOrder: CoverageStat;
  };
};

type SalvageDiagnostics = {
  attempted: boolean;
  sections?: string[];
  reason?: string;
};

const timelinePointSchema = {
  type: "object",
  properties: {
    timeSeconds: { type: "number" },
    value: { type: "number" },
    label: { type: "string" },
  },
  required: ["timeSeconds", "value"],
};

const spanSchema = {
  type: "object",
  properties: {
    startSeconds: { type: "number" },
    endSeconds: { type: "number" },
    value: { type: "number" },
    label: { type: "string" },
    alignedBeat: { type: "string" },
    alignedPunchline: { type: "boolean" },
  },
  required: ["startSeconds", "endSeconds"],
};

const segmentDeltaSchema = {
  type: "object",
  properties: {
    startSeconds: { type: "number" },
    endSeconds: { type: "number" },
    deltaPct: { type: "number" },
    label: { type: "string" },
  },
  required: ["startSeconds", "endSeconds"],
};

const metricSchema = {
  type: "object",
  properties: {
    score: { type: "number" },
    value: { type: "string" },
    explanation: { type: "string" },
    timeline: {
      type: "array",
      items: timelinePointSchema,
      minItems: 1,
    },
    spans: {
      type: "array",
      items: spanSchema,
      minItems: 1,
    },
    segments: {
      type: "array",
      items: segmentDeltaSchema,
      minItems: 1,
    },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          value: { type: "number" },
        },
      },
      minItems: 1,
    },
    proportions: {
      type: "object",
      properties: {
        value: { type: "number" },
      },
    },
    counts: {
      type: "object",
      properties: {
        value: { type: "number" },
      },
    },
    trend: { type: "number" },
    observed: { type: "boolean" },
  },
  required: ["score", "value", "explanation"],
};

const buildMetricProperties = (keys: readonly string[]) =>
  Object.fromEntries(keys.map((key) => [key, metricSchema]));

const buildMetricObjectSchema = (keys: readonly string[]) => ({
  type: "object",
  properties: buildMetricProperties(keys),
  required: [...keys],
});

const narrativeMetricKeys = BASE_DOMAIN_METRICS.narrative as readonly string[];
const ADVANCED_AUDIO_TEXT_SECTIONS: AdvancedSectionKey[] = [
  "prosodyArc",
  "languageTexture",
  "narrativeArc",
];
const ADVANCED_VISUAL_CROSS_SECTIONS: AdvancedSectionKey[] = [
  "visualEditAlignment",
  "modalityBalance",
  "cognitiveLoad",
];
const ADVANCED_GEMINI_SECTIONS: AdvancedSectionKey[] = [
  ...ADVANCED_AUDIO_TEXT_SECTIONS,
  ...ADVANCED_VISUAL_CROSS_SECTIONS,
];

// Lightweight JSON schema to guide Gemini; validation still enforced via zod.
const buildAdvancedMetricsJsonSchema = (sections: AdvancedSectionKey[]) => ({
  type: "object",
  properties: Object.fromEntries(
    sections.map((section) => [section, buildMetricObjectSchema(ADVANCED_METRIC_SECTIONS[section])]),
  ),
  required: [...sections],
});

const coreResponseJsonSchema = {
  type: "object",
  properties: {
    voice: buildMetricObjectSchema(BASE_DOMAIN_METRICS.voice),
    language: buildMetricObjectSchema(BASE_DOMAIN_METRICS.language),
    narrative: {
      type: "object",
      properties: {
        beats: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              start: { type: "number" },
              end: { type: "number" },
              role: { type: "string" },
            },
            required: ["label", "start", "end"],
          },
          minItems: 1,
        },
        ...buildMetricProperties(narrativeMetricKeys),
        devices: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              timestamp: { type: "number" },
            },
            required: ["type", "timestamp"],
          },
        },
      },
      required: ["beats", ...narrativeMetricKeys],
    },
    visual_edit_sound: buildMetricObjectSchema(BASE_DOMAIN_METRICS.visual_edit_sound),
  },
  required: ["voice", "language", "narrative", "visual_edit_sound"],
};

const advancedAudioTextResponseJsonSchema = {
  type: "object",
  properties: {
    advanced_metrics: buildAdvancedMetricsJsonSchema(ADVANCED_AUDIO_TEXT_SECTIONS),
  },
  required: ["advanced_metrics"],
};

const advancedVisualCrossResponseJsonSchema = {
  type: "object",
  properties: {
    advanced_metrics: buildAdvancedMetricsJsonSchema(ADVANCED_VISUAL_CROSS_SECTIONS),
  },
  required: ["advanced_metrics"],
};

const systemInstruction = [
  "You are a video analysis engine.",
  "You analyze the provided YouTube video URL directly.",
  "Measure the requested metrics directly from audio + visuals.",
  "If a metric cannot be observed, set value: \"unobserved\" and score: 0.",
  "Always include timelines/spans/items where requested; do not leave required arrays empty.",
  "Respond with strict JSON only.",
].join("\n");

const ADVANCED_SECTION_LINES: Record<AdvancedSectionKey, string> = {
  prosodyArc:
    "prosodyArc: paceMeanWpm (timeline 10s windows), paceVariabilityPct (timeline), withinSegmentPaceChangePct (segments with deltaPct), emphasisAlignmentScore (items for stressed phrases + time), energyDriftDbPerMin (trend + smoothed timeline).",
  languageTexture:
    "languageTexture: analogyExampleDefinitionRatio (counts proportions), sentenceCompressionRatio (words per idea + distribution/timeline), humorTimingScore (items with setupStart/punchStart/deltaSeconds/landed), referenceDensityPerMin (counts by type), questionRate (counts for rhetorical vs genuine + timeline), audienceAddressFrequency (counts per minute with direct vs rhetorical breakdown and optional timeline).",
  narrativeArc:
    "narrativeArc: timeToHookSeconds (derive from first hook beat if present), hookStrengthScore (items with beatTime, devices, promiseClarity), segmentCohesionDrift (timeline per segment), openLoopsUnresolvedRatio (items openedAt/resolvedAt/label), endingResolutionScore (items payoffDelivered/ctaClarity/callbackCount).",
  visualEditAlignment:
    "visualEditAlignment: visualEntropy (timeline), cutRateRefinement (items medianShotSeconds/variance/beatCouplingDelta), silenceForEmphasisFidelity (relative-energy speech gaps >0.6s; spans include start/end/durationSec, value=strength 0-100, label=placement intent reset|punch|transition, alignedBeat/punchline), audioVisualEmphasisAlignment (timeline with offsets), beatsVsEditsAlignment (timeline per beat), prosodyVsSemanticImportanceAlignment (items phrase/importanceScore/stressed).",
  modalityBalance:
    "modalityBalance: redundancyVsComplementarity (proportions redundantPct/complementaryPct/conflictingPct), modalityOverReliance (proportions with dominant mode).",
  cognitiveLoad: "cognitiveLoad: loadPerSecond (timeline 1 Hz), loadHighlights (spans with driver/label/value).",
};

const COMMON_ADVANCED_RULES = [
  "- Provide timelines/spans/items for the metrics noted above; keep arrays non-empty when observable.",
  "- JSON only; no prose.",
  "- If safety filters block content, return an object matching the schema with unobserved metrics.",
];

const ADVANCED_SECTION_RULES: Partial<Record<AdvancedSectionKey, string[]>> = {
  prosodyArc: [
    "- Populate pace/energy timelines (mean/variability/within-segment/energy drift) so they are not left unobserved when media is available.",
  ],
  visualEditAlignment: [
    "- For silence spans, detect relative drops vs local noise floor (tolerate crowd/bed noise), require >=0.6s duration, and annotate placement intent + strength; align to nearby beats/punchlines when present.",
    "- Populate visual entropy/cut refinement timelines so they are not left unobserved when media is available.",
  ],
  cognitiveLoad: ["- Populate load timelines so they are not left unobserved when media is available."],
};

const corePrompt = [
  "Return JSON matching the schema. Use camelCase metric keys. All scores are 0-100. If any metric is not observable, set value:\"unobserved\" and score:0.",
  "Base domains:",
  "- voice: speaking_rate, filler_rate, pauses, loudness_range, pitch_variation.",
  "- language: concreteness, metaphor_density, references, humor, teaching_vs_riffing.",
  "- narrative: beats [{label,start,end,role in hook|setup|escalation|payoff|outro|cta|break}], mini_arc_density, foreshadow_callbacks, transition_clarity, story_presence, devices [{type,timestamp}].",
  "- visual_edit_sound: environment_stability, talking_vs_broll_vs_graphics, cut_rate, pattern_interrupts, broll_coverage, music_coverage, music_changes, sfx_density, silence_for_emphasis.",
  "Rules:",
  "- Provide beats using seconds and include hook/setup/escalation/payoff/outro labels when present; supply role in the beat object.",
  "- For narrative.devices, use types: contrast, foreshadow, callback, analogy, reversal, pattern_interrupt, stakes_change.",
  "- JSON only; no prose.",
  "- If safety filters block content, return an object matching the schema with unobserved metrics.",
].join("\n");

const advancedAudioTextPrompt = [
  "Return JSON matching the schema. Use camelCase metric keys. All scores are 0-100. If any metric is not observable, set value:\"unobserved\" and score:0.",
  "Advanced metrics (audio/text): include an `advanced_metrics` object with these sections:",
  `- ${ADVANCED_SECTION_LINES.prosodyArc}`,
  `- ${ADVANCED_SECTION_LINES.languageTexture}`,
  `- ${ADVANCED_SECTION_LINES.narrativeArc}`,
  "Rules:",
  ...COMMON_ADVANCED_RULES,
  ...ADVANCED_SECTION_RULES.prosodyArc!,
].join("\n");

const advancedVisualCrossPrompt = [
  "Return JSON matching the schema. Use camelCase metric keys. All scores are 0-100. If any metric is not observable, set value:\"unobserved\" and score:0.",
  "Advanced metrics (visual/cross): include an `advanced_metrics` object with these sections:",
  `- ${ADVANCED_SECTION_LINES.visualEditAlignment}`,
  `- ${ADVANCED_SECTION_LINES.modalityBalance}`,
  `- ${ADVANCED_SECTION_LINES.cognitiveLoad}`,
  "Rules:",
  ...COMMON_ADVANCED_RULES,
  ...ADVANCED_SECTION_RULES.visualEditAlignment!,
  ...ADVANCED_SECTION_RULES.cognitiveLoad!,
].join("\n");

const buildAdvancedSectionPrompt = (section: AdvancedSectionKey) =>
  [
    "Return JSON matching the schema. Use camelCase metric keys. All scores are 0-100. If any metric is not observable, set value:\"unobserved\" and score:0.",
    `Advanced metrics (salvage): include an \`advanced_metrics\` object with only ${section}:`,
    `- ${ADVANCED_SECTION_LINES[section]}`,
    "Rules:",
    ...COMMON_ADVANCED_RULES,
    ...(ADVANCED_SECTION_RULES[section] ?? []),
  ].join("\n");

const parsePercent = (raw: string | undefined, fallback: number) => {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(0, parsed));
};

const SALVAGE_UNOBSERVED_THRESHOLD_PCT = parsePercent(
  process.env.MULTIMODAL_SALVAGE_UNOBSERVED_PCT,
  50,
);

const shouldSalvageSection = (stat: CoverageStat) =>
  stat.available && stat.total > 0 && 100 - stat.observedPct >= SALVAGE_UNOBSERVED_THRESHOLD_PCT;

export const multimodalResponseJsonSchema = coreResponseJsonSchema;
export const multimodalPrompt = corePrompt;
export const multimodalSystemInstruction = systemInstruction;

const axisId = (domain: DomainKey, metricKey: string): string => `${domain}.${metricKey}`;

const normalizeMetricValue = (value: GeminiObservedMetric["value"] | undefined): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const toScores = (
  domain: DomainKey,
  metricKeys: string[],
  metrics: Record<string, GeminiObservedMetric>,
  detailMaps?: { domainDetails?: Record<string, AxisDetail>; globalDetails?: Record<string, AxisDetail> },
): DomainProfile["scores"] =>
  metricKeys
    .map((key) => {
      const metric = metrics[key];
      if (!metric) return null;
      const safeScore = Number.isFinite(metric.score) ? metric.score : 0;
      const axisKey = axisId(domain, key);
      const meta = resolveAxisMetadata(axisKey) ?? resolveAxisMetadata(key);
      const resolvedKey = meta?.id ?? axisKey;
      const rawValue = normalizeMetricValue(metric.value);
      const normalizedValue = rawValue === "" && safeScore === 0 ? "unobserved" : rawValue;
      const detail: AxisDetail = {
        rawValue: normalizedValue,
        explanation: metric.explanation ?? "",
        observed: normalizedValue !== "unobserved" && safeScore !== 0,
      };
      if (detailMaps?.domainDetails) {
        detailMaps.domainDetails[resolvedKey] = detail;
      }
      if (detailMaps?.globalDetails) {
        detailMaps.globalDetails[resolvedKey] = detail;
      }
      return { key: resolvedKey, label: meta?.label ?? key, value: safeScore };
    })
    .filter(Boolean) as DomainProfile["scores"];

const unobserved = (metricKeys: string[], metrics: Record<string, GeminiObservedMetric>) =>
  metricKeys.filter((key) => metrics[key]?.value === "unobserved" || metrics[key]?.score === 0);

const buildCoverage = (
  metricKeys: readonly string[],
  metrics: Record<string, GeminiObservedMetric>,
  available = true,
): CoverageStat => {
  const missing = metricKeys.filter((key) => {
    const metric = metrics[key];
    if (!metric) return true;
    return metric.value === "unobserved" || metric.score === 0;
  });
  const total = metricKeys.length;
  const observed = Math.max(0, total - missing.length);
  const observedPct = total === 0 ? 0 : Math.round((observed / total) * 100);
  return { observed, total, missing, observedPct, available };
};

const buildCoverageDiagnostics = (
  response: GeminiMultimodalResponse,
  advanced?: GeminiAdvancedMetricsPartial,
  derivedSecondOrder?: AdvancedFingerprintMetrics["secondOrder"],
): CoverageDiagnostics => {
  const core = {
    voice: buildCoverage(
      BASE_DOMAIN_METRICS.voice,
      response.voice as unknown as Record<string, GeminiObservedMetric>,
      true,
    ),
    language: buildCoverage(
      BASE_DOMAIN_METRICS.language,
      response.language as unknown as Record<string, GeminiObservedMetric>,
      true,
    ),
    narrative: buildCoverage(
      BASE_DOMAIN_METRICS.narrative,
      response.narrative as unknown as Record<string, GeminiObservedMetric>,
      true,
    ),
    visual_edit_sound: buildCoverage(
      BASE_DOMAIN_METRICS.visual_edit_sound,
      response.visual_edit_sound as unknown as Record<string, GeminiObservedMetric>,
      true,
    ),
  };

  const advancedCoverage = {
    prosodyArc: buildCoverage(
      ADVANCED_METRIC_SECTIONS.prosodyArc,
      (advanced?.prosodyArc ?? {}) as Record<string, GeminiObservedMetric>,
      Boolean(advanced?.prosodyArc),
    ),
    languageTexture: buildCoverage(
      ADVANCED_METRIC_SECTIONS.languageTexture,
      (advanced?.languageTexture ?? {}) as Record<string, GeminiObservedMetric>,
      Boolean(advanced?.languageTexture),
    ),
    narrativeArc: buildCoverage(
      ADVANCED_METRIC_SECTIONS.narrativeArc,
      (advanced?.narrativeArc ?? {}) as Record<string, GeminiObservedMetric>,
      Boolean(advanced?.narrativeArc),
    ),
    visualEditAlignment: buildCoverage(
      ADVANCED_METRIC_SECTIONS.visualEditAlignment,
      (advanced?.visualEditAlignment ?? {}) as Record<string, GeminiObservedMetric>,
      Boolean(advanced?.visualEditAlignment),
    ),
    modalityBalance: buildCoverage(
      ADVANCED_METRIC_SECTIONS.modalityBalance,
      (advanced?.modalityBalance ?? {}) as Record<string, GeminiObservedMetric>,
      Boolean(advanced?.modalityBalance),
    ),
    cognitiveLoad: buildCoverage(
      ADVANCED_METRIC_SECTIONS.cognitiveLoad,
      (advanced?.cognitiveLoad ?? {}) as Record<string, GeminiObservedMetric>,
      Boolean(advanced?.cognitiveLoad),
    ),
    secondOrder: buildCoverage(
      SECOND_ORDER_METRICS,
      (derivedSecondOrder ?? {}) as Record<string, GeminiObservedMetric>,
      Boolean(derivedSecondOrder),
    ),
  };

  return {
    core,
    advanced: advancedCoverage,
  };
};

const summarize = (
  domain: DomainKey,
  domainName: string,
  metricKeys: string[],
  metrics: Record<string, GeminiObservedMetric>,
) => {
  const observed = metricKeys
    .map((key) => ({ key, metric: metrics[key] }))
    .filter((m) => m.metric && m.metric.value !== "unobserved");

  const snippets = observed
    .slice(0, 2)
    .map(
      ({ key, metric }) =>
        `${resolveAxisMetadata(axisId(domain, key))?.label ?? key}: ${normalizeMetricValue(metric.value)}`,
    );
  if (snippets.length === 0) return `${domainName} metrics could not be observed with confidence.`;
  return `${domainName} highlights — ${snippets.join("; ")}.`;
};

const normalizeBeatRole = (label: string): BeatRole | undefined => {
  const lower = label.toLowerCase();
  if (lower.includes("hook")) return "hook";
  if (lower.includes("setup") || lower.includes("intro")) return "setup";
  if (lower.includes("escalation") || lower.includes("build")) return "escalation";
  if (lower.includes("payoff") || lower.includes("climax")) return "payoff";
  if (lower.includes("outro") || lower.includes("cta")) return "outro";
  if (lower.includes("break")) return "break";
  return undefined;
};

const toBeatSegments = (
  beats: GeminiMultimodalResponse["narrative"]["beats"],
  devices?: GeminiMultimodalResponse["narrative"]["devices"],
): BeatSegment[] =>
  beats.map((beat) => ({
    label: beat.label,
    role: normalizeBeatRole(beat.role ?? beat.label),
    startSeconds: beat.start,
    endSeconds: beat.end,
    devices:
      devices
        ?.filter((d) => d.timestamp >= beat.start && d.timestamp <= beat.end)
        .map((d) => d.type) ?? [],
  }));

const buildDomainProfile = (
  domain: DomainKey,
  domainName: string,
  metricKeys: string[],
  metrics: Record<string, GeminiObservedMetric>,
  axisDetails: Record<string, AxisDetail>,
  extraHighlights?: string[],
): DomainProfile => {
  const domainDetails: Record<string, AxisDetail> = {};
  const scores = toScores(domain, metricKeys, metrics, {
    domainDetails,
    globalDetails: axisDetails,
  });
  const missing = unobserved(metricKeys, metrics);
  const highlights = [
    ...(extraHighlights ?? []),
    ...(missing.length ? [`Unobserved: ${missing.join(", ")}`] : []),
  ];

  return {
    primaryArchetype: `Multimodal ${domainName}`,
    summaryText: summarize(domain, domainName, metricKeys, metrics),
    scores,
    axisDetails: domainDetails,
    highlights: highlights.length > 0 ? highlights : undefined,
  };
};

const buildProfiles = (
  response: GeminiMultimodalResponse,
  axisDetails: Record<string, AxisDetail>,
): MultimodalProfiles => {
  const voice = buildDomainProfile(
    "voice",
    "Voice",
    [...BASE_DOMAIN_METRICS.voice],
    response.voice as unknown as Record<string, GeminiObservedMetric>,
    axisDetails,
  );
  const language = buildDomainProfile(
    "language",
    "Language",
    [...BASE_DOMAIN_METRICS.language],
    response.language as unknown as Record<string, GeminiObservedMetric>,
    axisDetails,
  );
  const narrative = buildDomainProfile(
    "narrative",
    "Narrative",
    [...BASE_DOMAIN_METRICS.narrative],
    response.narrative as unknown as Record<string, GeminiObservedMetric>,
    axisDetails,
  );

  const ves = response.visual_edit_sound as unknown as Record<string, GeminiObservedMetric>;

  const visual = buildDomainProfile(
    "visual",
    "Visual",
    ["environment_stability", "talking_vs_broll_vs_graphics", "pattern_interrupts"],
    ves,
    axisDetails,
  );

  const editing = buildDomainProfile(
    "editing",
    "Editing",
    ["cut_rate", "pattern_interrupts", "broll_coverage"],
    ves,
    axisDetails,
  );

  const soundHighlights: string[] = [];
  const musicCoverageValue = normalizeMetricValue(ves.music_coverage?.value);
  if (musicCoverageValue && musicCoverageValue.toLowerCase() !== "unobserved") {
    soundHighlights.push(`Music coverage ~${musicCoverageValue}`);
  }
  const musicChangesValue = normalizeMetricValue(ves.music_changes?.value);
  if (musicChangesValue && musicChangesValue.toLowerCase() !== "unobserved") {
    soundHighlights.push(`Music changes: ${musicChangesValue}`);
  }
  const soundExtraHighlights = soundHighlights.filter(Boolean);
  const sound = buildDomainProfile(
    "sound",
    "Sound",
    ["music_coverage", "music_changes", "sfx_density", "silence_for_emphasis"],
    ves,
    axisDetails,
    soundExtraHighlights.length ? soundExtraHighlights : undefined,
  );

  return { voice, language, narrative, visual, editing, sound };
};

const collectUnobservedCounts = (response: GeminiMultimodalResponse): Record<string, number> => ({
  voice: unobserved(
    BASE_DOMAIN_METRICS.voice as unknown as string[],
    response.voice as unknown as Record<string, GeminiObservedMetric>,
  ).length,
  language: unobserved(
    BASE_DOMAIN_METRICS.language as unknown as string[],
    response.language as unknown as Record<string, GeminiObservedMetric>,
  ).length,
  narrative: unobserved(
    BASE_DOMAIN_METRICS.narrative as unknown as string[],
    response.narrative as unknown as Record<string, GeminiObservedMetric>,
  ).length,
  visual_edit_sound: unobserved(
    BASE_DOMAIN_METRICS.visual_edit_sound as unknown as string[],
    response.visual_edit_sound as unknown as Record<string, GeminiObservedMetric>,
  ).length,
});

const mapMetric = (metric: GeminiRichMetric | undefined, fallback: ScoredMetric): ScoredMetric => {
  if (!metric) return fallback;
  const normalizedValue = normalizeMetricValue(metric.value);
  const observed =
    metric.observed !== undefined
      ? metric.observed
      : normalizedValue.toLowerCase() !== "unobserved" && metric.score !== 0;
  return {
    score: Number.isFinite(metric.score) ? metric.score : fallback.score,
    value: normalizedValue || fallback.value,
    observed,
    timeline: metric.timeline ?? fallback.timeline,
    spans: metric.spans ?? fallback.spans,
    segments: metric.segments ?? fallback.segments,
    items: metric.items ?? fallback.items,
    proportions: metric.proportions ?? fallback.proportions,
    counts: metric.counts ?? fallback.counts,
    trend: metric.trend ?? fallback.trend,
  };
};

const mapAdvancedMetrics = (
  advanced?: GeminiAdvancedMetricsPartial,
  defaults?: AdvancedFingerprintMetrics,
): AdvancedFingerprintMetrics | undefined => {
  if (!advanced) return undefined;
  const base = defaults ?? buildDefaultAdvancedMetrics();
  const mapped: AdvancedFingerprintMetrics = {
    prosodyArc: {
      paceMeanWpm: mapMetric(advanced.prosodyArc?.paceMeanWpm, base.prosodyArc.paceMeanWpm),
      paceVariabilityPct: mapMetric(advanced.prosodyArc?.paceVariabilityPct, base.prosodyArc.paceVariabilityPct),
      withinSegmentPaceChangePct: mapMetric(
        advanced.prosodyArc?.withinSegmentPaceChangePct,
        base.prosodyArc.withinSegmentPaceChangePct,
      ),
      emphasisAlignmentScore: mapMetric(
        advanced.prosodyArc?.emphasisAlignmentScore,
        base.prosodyArc.emphasisAlignmentScore,
      ),
      energyDriftDbPerMin: mapMetric(
        advanced.prosodyArc?.energyDriftDbPerMin,
        base.prosodyArc.energyDriftDbPerMin,
      ),
    },
    languageTexture: {
      analogyExampleDefinitionRatio: mapMetric(
        advanced.languageTexture?.analogyExampleDefinitionRatio,
        base.languageTexture.analogyExampleDefinitionRatio,
      ),
      sentenceCompressionRatio: mapMetric(
        advanced.languageTexture?.sentenceCompressionRatio,
        base.languageTexture.sentenceCompressionRatio,
      ),
      humorTimingScore: mapMetric(
        advanced.languageTexture?.humorTimingScore,
        base.languageTexture.humorTimingScore,
      ),
      referenceDensityPerMin: mapMetric(
        advanced.languageTexture?.referenceDensityPerMin,
        base.languageTexture.referenceDensityPerMin,
      ),
      questionRate: mapMetric(advanced.languageTexture?.questionRate, base.languageTexture.questionRate),
      audienceAddressFrequency: mapMetric(
        advanced.languageTexture?.audienceAddressFrequency,
        base.languageTexture.audienceAddressFrequency,
      ),
    },
    narrativeArc: {
      timeToHookSeconds: mapMetric(
        advanced.narrativeArc?.timeToHookSeconds,
        base.narrativeArc.timeToHookSeconds,
      ),
      hookStrengthScore: mapMetric(advanced.narrativeArc?.hookStrengthScore, base.narrativeArc.hookStrengthScore),
      segmentCohesionDrift: mapMetric(
        advanced.narrativeArc?.segmentCohesionDrift,
        base.narrativeArc.segmentCohesionDrift,
      ),
      openLoopsUnresolvedRatio: mapMetric(
        advanced.narrativeArc?.openLoopsUnresolvedRatio,
        base.narrativeArc.openLoopsUnresolvedRatio,
      ),
      endingResolutionScore: mapMetric(
        advanced.narrativeArc?.endingResolutionScore,
        base.narrativeArc.endingResolutionScore,
      ),
    },
    visualEditAlignment: {
      visualEntropy: mapMetric(advanced.visualEditAlignment?.visualEntropy, base.visualEditAlignment.visualEntropy),
      cutRateRefinement: mapMetric(
        advanced.visualEditAlignment?.cutRateRefinement,
        base.visualEditAlignment.cutRateRefinement,
      ),
      silenceForEmphasisFidelity: mapMetric(
        advanced.visualEditAlignment?.silenceForEmphasisFidelity,
        base.visualEditAlignment.silenceForEmphasisFidelity,
      ),
      audioVisualEmphasisAlignment: mapMetric(
        advanced.visualEditAlignment?.audioVisualEmphasisAlignment,
        base.visualEditAlignment.audioVisualEmphasisAlignment,
      ),
      beatsVsEditsAlignment: mapMetric(
        advanced.visualEditAlignment?.beatsVsEditsAlignment,
        base.visualEditAlignment.beatsVsEditsAlignment,
      ),
      prosodyVsSemanticImportanceAlignment: mapMetric(
        advanced.visualEditAlignment?.prosodyVsSemanticImportanceAlignment,
        base.visualEditAlignment.prosodyVsSemanticImportanceAlignment,
      ),
    },
    modalityBalance: {
      redundancyVsComplementarity: mapMetric(
        advanced.modalityBalance?.redundancyVsComplementarity,
        base.modalityBalance.redundancyVsComplementarity,
      ),
      modalityOverReliance: mapMetric(
        advanced.modalityBalance?.modalityOverReliance,
        base.modalityBalance.modalityOverReliance,
      ),
    },
    cognitiveLoad: {
      loadPerSecond: mapMetric(advanced.cognitiveLoad?.loadPerSecond, base.cognitiveLoad.loadPerSecond),
      loadHighlights: mapMetric(advanced.cognitiveLoad?.loadHighlights, base.cognitiveLoad.loadHighlights),
    },
  };
  return {
    ...mapped,
    secondOrder: computeSecondOrderScores(mapped),
  };
};

const toError = (result: GeminiMultimodalResult): GeminiApiError & { code?: GeminiMultimodalErrorCode } => {
  const isError = result.ok === false;
  const message = isError ? result.errorMessage : "Unknown Gemini multimodal error";
  const type: "InvalidResponse" | "UpstreamError" =
    isError && result.errorCode === "INVALID_RESPONSE" ? "InvalidResponse" : "UpstreamError";
  const error = new GeminiApiError(type, message, result.status) as GeminiApiError & {
    code?: GeminiMultimodalErrorCode;
  };
  if (isError) {
    error.code = result.errorCode;
  }
  return error;
};

type AdvancedPassOutcome = {
  metrics?: GeminiAdvancedMetricsPartial;
  status?: number;
  passMetrics?: GeminiRequestMetrics;
};

const addUsageTotals = (acc: GeminiUsage, usage?: GeminiUsage) => {
  if (!usage) return;
  acc.promptTokens = (acc.promptTokens ?? 0) + (usage.promptTokens ?? 0);
  acc.candidateTokens = (acc.candidateTokens ?? 0) + (usage.candidateTokens ?? 0);
  acc.totalTokens = (acc.totalTokens ?? 0) + (usage.totalTokens ?? 0);
  acc.cachedTokens = (acc.cachedTokens ?? 0) + (usage.cachedTokens ?? 0);
};

const buildPassTotals = (metrics: PassMetricsDiagnostics): PassMetricsTotals | undefined => {
  const allMetrics: GeminiRequestMetrics[] = [];
  if (metrics.core) allMetrics.push(metrics.core);
  if (metrics.advancedAudioText) allMetrics.push(metrics.advancedAudioText);
  if (metrics.advancedVisualCross) allMetrics.push(metrics.advancedVisualCross);
  if (metrics.salvage) {
    allMetrics.push(...Object.values(metrics.salvage));
  }
  if (allMetrics.length === 0) return undefined;

  let durationMs = 0;
  let attempts = 0;
  let retries = 0;
  let costTotal: number | undefined;
  let usageTotal: GeminiUsage | undefined;

  for (const entry of allMetrics) {
    durationMs += entry.durationMs;
    attempts += entry.attempts;
    retries += entry.retries;
    if (entry.estimatedCostUsd !== undefined) {
      costTotal = (costTotal ?? 0) + entry.estimatedCostUsd;
    }
    if (entry.usage) {
      usageTotal = usageTotal ?? {};
      addUsageTotals(usageTotal, entry.usage);
    }
  }

  return {
    durationMs,
    attempts,
    retries,
    usage: usageTotal,
    estimatedCostUsd: costTotal,
  };
};

const mergeAdvancedMetrics = (
  ...parts: Array<GeminiAdvancedMetricsPartial | undefined>
): GeminiAdvancedMetricsPartial | undefined => {
  const merged: GeminiAdvancedMetricsPartial = {};
  for (const part of parts) {
    if (!part) continue;
    for (const [key, value] of Object.entries(part)) {
      if (value) {
        merged[key as AdvancedSectionKey] =
          value as GeminiAdvancedMetricsPartial[AdvancedSectionKey];
      }
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
};

const shouldReplaceSection = (
  section: AdvancedSectionKey,
  current: GeminiAdvancedMetricsPartial[AdvancedSectionKey] | undefined,
  salvage: GeminiAdvancedMetricsPartial[AdvancedSectionKey] | undefined,
) => {
  if (!salvage) return false;
  if (!current) return true;
  const currentCoverage = buildCoverage(
    ADVANCED_METRIC_SECTIONS[section],
    current as unknown as Record<string, GeminiObservedMetric>,
    true,
  );
  const salvageCoverage = buildCoverage(
    ADVANCED_METRIC_SECTIONS[section],
    salvage as unknown as Record<string, GeminiObservedMetric>,
    true,
  );
  return salvageCoverage.observed >= currentCoverage.observed;
};

const applySalvageMetrics = (
  current: GeminiAdvancedMetricsPartial | undefined,
  salvage: GeminiAdvancedMetricsPartial | undefined,
): GeminiAdvancedMetricsPartial | undefined => {
  if (!salvage) return current;
  const merged: GeminiAdvancedMetricsPartial = { ...(current ?? {}) };
  for (const [key, value] of Object.entries(salvage)) {
    const section = key as AdvancedSectionKey;
    if (shouldReplaceSection(section, merged[section], value as GeminiAdvancedMetricsPartial[AdvancedSectionKey])) {
      merged[section] = value as GeminiAdvancedMetricsPartial[AdvancedSectionKey];
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
};

const runAdvancedPass = async (input: {
  youtubeUrl: string;
  config?: AppConfig;
  prompt: string;
  jsonSchema: unknown;
  sections: AdvancedSectionKey[];
  model?: string;
}): Promise<AdvancedPassOutcome> => {
  const result = await callGeminiMultimodalJson({
    youtubeUrl: input.youtubeUrl,
    prompt: input.prompt,
    systemInstruction,
    jsonSchema: input.jsonSchema,
    config: input.config,
    model: input.model,
  });

  if (!result.ok) {
    return { status: result.status, passMetrics: result.metrics };
  }

  try {
    const parsed = parseGeminiAdvancedMetricsJson(result.rawJson, input.sections);
    return {
      metrics: parsed,
      status: result.status,
      passMetrics: result.metrics,
    };
  } catch {
    return { status: result.status, passMetrics: result.metrics };
  }
};

export const analyzeVideoMultimodal = async (input: {
  youtubeUrl: string;
  config?: AppConfig;
}): Promise<MultimodalAnalysisResult> => {
  const passMode = input.config?.multimodalPassMode ?? "full";
  const advancedMetricsEnabled = passMode !== "core" && input.config?.advancedMetricsEnabled !== false;
  const coreModel = input.config?.geminiMultimodalCoreModel;
  const advancedAudioModel = input.config?.geminiMultimodalAdvancedAudioModel;
  const advancedVisualModel = input.config?.geminiMultimodalAdvancedVisualModel;
  const salvageModel = input.config?.geminiMultimodalSalvageModel;

  const result = await callGeminiMultimodalJson({
    youtubeUrl: input.youtubeUrl,
    prompt: corePrompt,
    systemInstruction,
    jsonSchema: coreResponseJsonSchema,
    config: input.config,
    model: coreModel,
  });

  if (!result.ok) {
    throw toError(result);
  }

  const corePassMetrics = result.metrics;
  const parsed = parseGeminiMultimodalJson(result.rawJson);
  const axisDetails: Record<string, AxisDetail> = {};
  const profiles = buildProfiles(parsed, axisDetails);
  const audioTextPass = advancedMetricsEnabled
    ? await runAdvancedPass({
        youtubeUrl: input.youtubeUrl,
        prompt: advancedAudioTextPrompt,
        jsonSchema: advancedAudioTextResponseJsonSchema,
        sections: ADVANCED_AUDIO_TEXT_SECTIONS,
        config: input.config,
        model: advancedAudioModel,
      })
    : undefined;
  const visualCrossPass = advancedMetricsEnabled
    ? await runAdvancedPass({
        youtubeUrl: input.youtubeUrl,
        prompt: advancedVisualCrossPrompt,
        jsonSchema: advancedVisualCrossResponseJsonSchema,
        sections: ADVANCED_VISUAL_CROSS_SECTIONS,
        config: input.config,
        model: advancedVisualModel,
      })
    : undefined;
  const passMetrics: PassMetricsDiagnostics = {
    core: corePassMetrics,
    advancedAudioText: audioTextPass?.passMetrics,
    advancedVisualCross: visualCrossPass?.passMetrics,
  };

  let mergedAdvanced = mergeAdvancedMetrics(audioTextPass?.metrics, visualCrossPass?.metrics);
  const coverageBeforeSalvage = buildCoverageDiagnostics(parsed, mergedAdvanced);
  const salvageSections: AdvancedSectionKey[] = [];
  const salvagePassMetrics: Record<string, GeminiRequestMetrics> = {};

  if (advancedMetricsEnabled && coverageBeforeSalvage.advanced) {
    for (const section of ADVANCED_GEMINI_SECTIONS) {
      const stat = coverageBeforeSalvage.advanced[section];
      if (stat && shouldSalvageSection(stat)) {
        salvageSections.push(section);
      }
    }
  }

  if (advancedMetricsEnabled && salvageSections.length > 0) {
    for (const section of salvageSections) {
      const sectionModel =
        ADVANCED_AUDIO_TEXT_SECTIONS.includes(section) ? advancedAudioModel : advancedVisualModel;
      const salvagePass = await runAdvancedPass({
        youtubeUrl: input.youtubeUrl,
        prompt: buildAdvancedSectionPrompt(section),
        jsonSchema: {
          type: "object",
          properties: {
            advanced_metrics: buildAdvancedMetricsJsonSchema([section]),
          },
          required: ["advanced_metrics"],
        },
        sections: [section],
        config: input.config,
        model: salvageModel ?? sectionModel,
      });
      if (salvagePass.passMetrics) {
        salvagePassMetrics[section] = salvagePass.passMetrics;
      }
      mergedAdvanced = applySalvageMetrics(
        mergedAdvanced,
        mergeAdvancedMetrics(salvagePass.metrics),
      );
    }
  }

  const advancedMetrics = mapAdvancedMetrics(mergedAdvanced);
  if (Object.keys(salvagePassMetrics).length > 0) {
    passMetrics.salvage = salvagePassMetrics;
  }
  passMetrics.totals = buildPassTotals(passMetrics);

  return {
    profiles,
    beats: toBeatSegments(parsed.narrative.beats, parsed.narrative.devices),
    axisDetails,
    diagnostics: {
      unobservedCounts: collectUnobservedCounts(parsed),
      coverage: buildCoverageDiagnostics(parsed, mergedAdvanced, advancedMetrics?.secondOrder),
      salvage: {
        attempted: salvageSections.length > 0,
        sections: salvageSections.length > 0 ? salvageSections : undefined,
        reason:
          salvageSections.length > 0
            ? `unobserved >= ${SALVAGE_UNOBSERVED_THRESHOLD_PCT}%`
            : undefined,
      },
      rawStatus: result.status,
      passMetrics,
    },
    advancedMetrics,
  };
};
