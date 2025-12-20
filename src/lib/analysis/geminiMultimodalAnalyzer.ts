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
  type GeminiMultimodalResult,
} from "../gemini/client";
import type {
  GeminiAdvancedMetrics,
  GeminiMultimodalResponse,
  GeminiObservedMetric,
  GeminiRichMetric,
} from "./types/multimodal";
import { parseGeminiMultimodalJson } from "./validators/geminiMultimodal";
import type { DomainKey } from "../archetypes/descriptions";
import { resolveAxisMetadata } from "./axisMetadata";
import { buildDefaultAdvancedMetrics } from "./fingerprint/defaults";

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
    fromFallback: boolean;
    unobservedCounts: Record<string, number>;
    rawStatus?: number;
  };
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
      items: { type: "object" },
      minItems: 1,
    },
    proportions: {
      type: "object",
      additionalProperties: { type: "number" },
    },
    counts: {
      type: "object",
      additionalProperties: { type: "number" },
    },
    trend: { type: "number" },
    observed: { type: "boolean" },
  },
  required: ["score", "value", "explanation"],
};

// Lightweight JSON schema to guide Gemini; validation still enforced via zod.
const responseJsonSchema = {
  type: "object",
  properties: {
    voice: {
      type: "object",
      properties: {
        speaking_rate: metricSchema,
        filler_rate: metricSchema,
        pauses: metricSchema,
        loudness_range: metricSchema,
        pitch_variation: metricSchema,
      },
      required: ["speaking_rate", "filler_rate", "pauses", "loudness_range", "pitch_variation"],
    },
    language: {
      type: "object",
      properties: {
        concreteness: metricSchema,
        metaphor_density: metricSchema,
        references: metricSchema,
        humor: metricSchema,
        teaching_vs_riffing: metricSchema,
      },
      required: ["concreteness", "metaphor_density", "references", "humor", "teaching_vs_riffing"],
    },
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
        mini_arc_density: metricSchema,
        foreshadow_callbacks: metricSchema,
        transition_clarity: metricSchema,
        story_presence: metricSchema,
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
      required: ["beats", "mini_arc_density", "foreshadow_callbacks", "transition_clarity"],
    },
    visual_edit_sound: {
      type: "object",
      properties: {
        environment_stability: metricSchema,
        talking_vs_broll_vs_graphics: metricSchema,
        cut_rate: metricSchema,
        pattern_interrupts: metricSchema,
        broll_coverage: metricSchema,
        music_coverage: metricSchema,
        music_changes: metricSchema,
        sfx_density: metricSchema,
        silence_for_emphasis: metricSchema,
      },
      required: [
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
    },
    advanced_metrics: {
      type: "object",
      properties: {
        prosodyArc: {
          type: "object",
          properties: {
            paceMeanWpm: metricSchema,
            paceVariabilityPct: metricSchema,
            withinSegmentPaceChangePct: metricSchema,
            emphasisAlignmentScore: metricSchema,
            energyDriftDbPerMin: metricSchema,
          },
          required: [
            "paceMeanWpm",
            "paceVariabilityPct",
            "withinSegmentPaceChangePct",
            "emphasisAlignmentScore",
            "energyDriftDbPerMin",
          ],
        },
        languageTexture: {
          type: "object",
          properties: {
            analogyExampleDefinitionRatio: metricSchema,
            sentenceCompressionRatio: metricSchema,
            humorTimingScore: metricSchema,
            referenceDensityPerMin: metricSchema,
            questionRate: metricSchema,
            audienceAddressFrequency: metricSchema,
          },
          required: [
            "analogyExampleDefinitionRatio",
            "sentenceCompressionRatio",
            "humorTimingScore",
            "referenceDensityPerMin",
            "questionRate",
            "audienceAddressFrequency",
          ],
        },
        narrativeArc: {
          type: "object",
          properties: {
            timeToHookSeconds: metricSchema,
            hookStrengthScore: metricSchema,
            segmentCohesionDrift: metricSchema,
            openLoopsUnresolvedRatio: metricSchema,
            endingResolutionScore: metricSchema,
          },
          required: [
            "timeToHookSeconds",
            "hookStrengthScore",
            "segmentCohesionDrift",
            "openLoopsUnresolvedRatio",
            "endingResolutionScore",
          ],
        },
        visualEditAlignment: {
          type: "object",
          properties: {
            visualEntropy: metricSchema,
            cutRateRefinement: metricSchema,
            silenceForEmphasisFidelity: metricSchema,
            audioVisualEmphasisAlignment: metricSchema,
            beatsVsEditsAlignment: metricSchema,
            prosodyVsSemanticImportanceAlignment: metricSchema,
          },
          required: [
            "visualEntropy",
            "cutRateRefinement",
            "silenceForEmphasisFidelity",
            "audioVisualEmphasisAlignment",
            "beatsVsEditsAlignment",
            "prosodyVsSemanticImportanceAlignment",
          ],
        },
        modalityBalance: {
          type: "object",
          properties: {
            redundancyVsComplementarity: metricSchema,
            modalityOverReliance: metricSchema,
          },
          required: ["redundancyVsComplementarity", "modalityOverReliance"],
        },
        cognitiveLoad: {
          type: "object",
          properties: {
            loadPerSecond: metricSchema,
            loadHighlights: metricSchema,
          },
          required: ["loadPerSecond", "loadHighlights"],
        },
        secondOrder: {
          type: "object",
          properties: {
            alignmentScore: metricSchema,
            driftScore: metricSchema,
            decayScore: metricSchema,
            balanceScore: metricSchema,
            timingScore: metricSchema,
          },
          required: ["alignmentScore", "driftScore", "decayScore", "balanceScore", "timingScore"],
        },
      },
      required: [
        "prosodyArc",
        "languageTexture",
        "narrativeArc",
        "visualEditAlignment",
        "modalityBalance",
        "cognitiveLoad",
        "secondOrder",
      ],
    },
  },
  required: ["voice", "language", "narrative", "visual_edit_sound", "advanced_metrics"],
};

const systemInstruction = [
  "You are a video analysis engine.",
  "You watch the attached YouTube video via file_data.",
  "Measure the requested metrics directly from audio + visuals.",
  "If a metric cannot be observed, set value: \"unobserved\" and score: 0.",
  "Always include timelines/spans/items where requested; do not leave required arrays empty.",
  "Respond with strict JSON only.",
].join("\n");

const userPrompt = [
  "Return JSON matching the schema. Use camelCase metric keys. All scores are 0-100. If any metric is not observable, set value:\"unobserved\" and score:0.",
  "Base domains:",
  "- voice: speaking_rate, filler_rate, pauses, loudness_range, pitch_variation.",
  "- language: concreteness, metaphor_density, references, humor, teaching_vs_riffing.",
  "- narrative: beats [{label,start,end,role in hook|setup|escalation|payoff|outro|cta|break}], mini_arc_density, foreshadow_callbacks, transition_clarity, story_presence, devices [{type,timestamp}].",
  "- visual_edit_sound: environment_stability, talking_vs_broll_vs_graphics, cut_rate, pattern_interrupts, broll_coverage, music_coverage, music_changes, sfx_density, silence_for_emphasis.",
  "Advanced metrics (alignment/arc/load): include an `advanced_metrics` object with these sections:",
  "- prosodyArc: paceMeanWpm (timeline 10s windows), paceVariabilityPct (timeline), withinSegmentPaceChangePct (segments with deltaPct), emphasisAlignmentScore (items for stressed phrases + time), energyDriftDbPerMin (trend + smoothed timeline).",
  "- languageTexture: analogyExampleDefinitionRatio (counts proportions), sentenceCompressionRatio (words per idea + distribution/timeline), humorTimingScore (items with setupStart/punchStart/deltaSeconds/landed), referenceDensityPerMin (counts by type), questionRate (counts for rhetorical vs genuine + timeline), audienceAddressFrequency (counts per minute with direct vs rhetorical breakdown and optional timeline).",
  "- narrativeArc: timeToHookSeconds (derive from first hook beat if present), hookStrengthScore (items with beatTime, devices, promiseClarity), segmentCohesionDrift (timeline per segment), openLoopsUnresolvedRatio (items openedAt/resolvedAt/label), endingResolutionScore (items payoffDelivered/ctaClarity/callbackCount).",
  "- visualEditAlignment: visualEntropy (timeline), cutRateRefinement (items medianShotSeconds/variance/beatCouplingDelta), silenceForEmphasisFidelity (relative-energy speech gaps >0.6s; spans include start/end/durationSec, value=strength 0-100, label=placement intent reset|punch|transition, alignedBeat/punchline), audioVisualEmphasisAlignment (timeline with offsets), beatsVsEditsAlignment (timeline per beat), prosodyVsSemanticImportanceAlignment (items phrase/importanceScore/stressed).",
  "- modalityBalance: redundancyVsComplementarity (proportions redundantPct/complementaryPct/conflictingPct), modalityOverReliance (proportions with dominant mode).",
  "- cognitiveLoad: loadPerSecond (timeline 1 Hz), loadHighlights (spans with driver/label/value).",
  "- secondOrder: alignmentScore, driftScore, decayScore, balanceScore, timingScore (summaries).",
  "Rules:",
  "- For silence spans, detect relative drops vs local noise floor (tolerate crowd/bed noise), require >=0.6s duration, and annotate placement intent + strength; align to nearby beats/punchlines when present.",
  "- Provide timelines/spans/items for the metrics noted above; keep arrays non-empty when observable (e.g., counts for language texture, timelines for pace/entropy/load, items for jokes/loops).",
  "- Populate pace/energy timelines (mean/variability/within-segment/energy drift) and visual entropy/cut refinement timelines so they are not left unobserved when media is available.",
  "- Provide beats using seconds and include hook/setup/escalation/payoff/outro labels when present; supply role in the beat object.",
  "- For narrative.devices, use types: contrast, foreshadow, callback, analogy, reversal, pattern_interrupt, stakes_change.",
  "- JSON only; no prose.",
  "- If safety filters block content, return an object matching the schema with unobserved metrics.",
].join("\n");

export const multimodalResponseJsonSchema = responseJsonSchema;
export const multimodalPrompt = userPrompt;
export const multimodalSystemInstruction = systemInstruction;

const axisId = (domain: DomainKey, metricKey: string): string => `${domain}.${metricKey}`;

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
      const detail: AxisDetail = {
        rawValue: metric.value ?? "",
        explanation: metric.explanation,
        observed: metric.value !== "unobserved" && metric.score !== 0,
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
    .map(({ key, metric }) => `${resolveAxisMetadata(axisId(domain, key))?.label ?? key}: ${metric.value}`);
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
  extraHighlight?: string,
): DomainProfile => {
  const domainDetails: Record<string, AxisDetail> = {};
  const scores = toScores(domain, metricKeys, metrics, {
    domainDetails,
    globalDetails: axisDetails,
  });
  const missing = unobserved(metricKeys, metrics);
  const highlights = [
    ...(extraHighlight ? [extraHighlight] : []),
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
  fromFallback: boolean,
  axisDetails: Record<string, AxisDetail>,
): MultimodalProfiles => {
  const voice = buildDomainProfile(
    "voice",
    "Voice",
    ["speaking_rate", "filler_rate", "pauses", "loudness_range", "pitch_variation"],
    response.voice as unknown as Record<string, GeminiObservedMetric>,
    axisDetails,
    fromFallback ? "Used fallback media path" : undefined,
  );
  const language = buildDomainProfile(
    "language",
    "Language",
    [
      "concreteness",
      "metaphor_density",
      "references",
      "humor",
      "teaching_vs_riffing",
      "sentiment",
      "directive_density",
      "self_disclosure",
      "sarcasm_irony",
    ],
    response.language as unknown as Record<string, GeminiObservedMetric>,
    axisDetails,
    fromFallback ? "Used fallback media path" : undefined,
  );
  const narrative = buildDomainProfile(
    "narrative",
    "Narrative",
    ["mini_arc_density", "foreshadow_callbacks", "transition_clarity", "story_presence"],
    response.narrative as unknown as Record<string, GeminiObservedMetric>,
    axisDetails,
    fromFallback ? "Used fallback media path" : undefined,
  );

  const ves = response.visual_edit_sound as unknown as Record<string, GeminiObservedMetric>;

  const visual = buildDomainProfile(
    "visual",
    "Visual",
    ["environment_stability", "talking_vs_broll_vs_graphics", "pattern_interrupts"],
    ves,
    axisDetails,
    fromFallback ? "Used fallback media path" : undefined,
  );

  const editing = buildDomainProfile(
    "editing",
    "Editing",
    ["cut_rate", "pattern_interrupts", "broll_coverage"],
    ves,
    axisDetails,
    fromFallback ? "Used fallback media path" : undefined,
  );

  const soundHighlights: string[] = [];
  if (ves.music_coverage?.value && ves.music_coverage.value !== "unobserved") {
    soundHighlights.push(`Music coverage ~${ves.music_coverage.value}`);
  }
  if (ves.music_changes?.value && ves.music_changes.value !== "unobserved") {
    soundHighlights.push(`Music changes: ${ves.music_changes.value}`);
  }
  const sound = buildDomainProfile(
    "sound",
    "Sound",
    ["music_coverage", "music_changes", "sfx_density", "silence_for_emphasis"],
    ves,
    axisDetails,
    fromFallback ? "Used fallback media path" : soundHighlights.join("; "),
  );

  return { voice, language, narrative, visual, editing, sound };
};

const collectUnobservedCounts = (response: GeminiMultimodalResponse): Record<string, number> => ({
  voice: unobserved(
    Object.keys(response.voice),
    response.voice as unknown as Record<string, GeminiObservedMetric>,
  ).length,
  language: unobserved(
    Object.keys(response.language),
    response.language as unknown as Record<string, GeminiObservedMetric>,
  ).length,
  narrative: unobserved(
    ["mini_arc_density", "foreshadow_callbacks", "transition_clarity"],
    response.narrative as unknown as Record<string, GeminiObservedMetric>,
  ).length,
  visual_edit_sound: unobserved(
    Object.keys(response.visual_edit_sound),
    response.visual_edit_sound as unknown as Record<string, GeminiObservedMetric>,
  ).length,
});

const mapMetric = (metric: GeminiRichMetric | undefined, fallback: ScoredMetric): ScoredMetric => {
  if (!metric) return fallback;
  const observed =
    metric.observed !== undefined
      ? metric.observed
      : metric.value?.toLowerCase() !== "unobserved" && metric.score !== 0;
  return {
    score: Number.isFinite(metric.score) ? metric.score : fallback.score,
    value: metric.value ?? fallback.value,
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
  advanced?: GeminiAdvancedMetrics,
  defaults?: AdvancedFingerprintMetrics,
): AdvancedFingerprintMetrics | undefined => {
  if (!advanced) return undefined;
  const base = defaults ?? buildDefaultAdvancedMetrics();
  return {
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
    secondOrder: {
      alignmentScore: mapMetric(advanced.secondOrder?.alignmentScore, base.secondOrder.alignmentScore),
      driftScore: mapMetric(advanced.secondOrder?.driftScore, base.secondOrder.driftScore),
      decayScore: mapMetric(advanced.secondOrder?.decayScore, base.secondOrder.decayScore),
      balanceScore: mapMetric(advanced.secondOrder?.balanceScore, base.secondOrder.balanceScore),
      timingScore: mapMetric(advanced.secondOrder?.timingScore, base.secondOrder.timingScore),
    },
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

export const analyzeVideoMultimodal = async (input: {
  youtubeUrl: string;
  config?: AppConfig;
}): Promise<MultimodalAnalysisResult> => {
  const result = await callGeminiMultimodalJson({
    youtubeUrl: input.youtubeUrl,
    prompt: userPrompt,
    systemInstruction,
    jsonSchema: responseJsonSchema,
    config: input.config,
  });

  if (!result.ok) {
    throw toError(result);
  }

  const parsed = parseGeminiMultimodalJson(result.rawJson);
  const axisDetails: Record<string, AxisDetail> = {};
  const profiles = buildProfiles(parsed, result.fromFallback, axisDetails);
  const advancedMetrics = mapAdvancedMetrics(parsed.advanced_metrics);

  return {
    profiles,
    beats: toBeatSegments(parsed.narrative.beats, parsed.narrative.devices),
    axisDetails,
    diagnostics: {
      fromFallback: result.fromFallback,
      unobservedCounts: collectUnobservedCounts(parsed),
      rawStatus: result.status,
    },
    advancedMetrics,
  };
};
