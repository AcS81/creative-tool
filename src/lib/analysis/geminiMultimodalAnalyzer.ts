import type { AppConfig } from "../config";
import type { AxisDetail, BeatRole, BeatSegment, DomainProfile } from "../types";
import {
  callGeminiMultimodalJson,
  GeminiApiError,
  type GeminiMultimodalErrorCode,
  type GeminiMultimodalResult,
} from "../gemini/client";
import type { GeminiMultimodalResponse, GeminiObservedMetric } from "./types/multimodal";
import { parseGeminiMultimodalJson } from "./validators/geminiMultimodal";
import type { DomainKey } from "../archetypes/descriptions";
import { resolveAxisMetadata } from "./axisMetadata";

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
  diagnostics: {
    fromFallback: boolean;
    unobservedCounts: Record<string, number>;
    rawStatus?: number;
  };
};

const metricSchema = {
  type: "object",
  properties: {
    score: { type: "number" },
    value: { type: "string" },
    explanation: { type: "string" },
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
  },
  required: ["voice", "language", "narrative", "visual_edit_sound"],
};

const systemInstruction = [
  "You are a video analysis engine.",
  "You watch the attached YouTube video via file_data.",
  "Measure the requested metrics directly from audio + visuals.",
  "Keep responses safe and non-graphic; summarize without quoting explicit content.",
  "If a metric cannot be observed, set value: \"unobserved\" and score: 0.",
  "Respond with strict JSON only.",
].join("\n");

const userPrompt = [
  "Return JSON for these domains:",
  "- voice: speaking_rate, filler_rate, pauses, loudness_range, pitch_variation.",
  "- language: concreteness, metaphor_density, references, humor, teaching_vs_riffing.",
  "- narrative: beats [{label,start,end}], mini_arc_density, foreshadow_callbacks, transition_clarity, story_presence, devices [{type,timestamp}].",
  "- visual_edit_sound: environment_stability, talking_vs_broll_vs_graphics, cut_rate, pattern_interrupts, broll_coverage, music_coverage, music_changes, sfx_density, silence_for_emphasis.",
  "Rules:",
  "- scores are 0-100 reflecting the observed strength/level.",
  "- value is a short raw measurement string.",
  "- explanation is a short justification.",
  "- Provide beats using seconds and include hook/setup/escalation/payoff/outro labels when present.",
  "- For narrative.devices, use types: contrast, foreshadow, callback, analogy, reversal, pattern_interrupt, stakes_change.",
  "- JSON only; no prose.",
  "- If safety filters block content, return an empty object that matches the schema shape with \"unobserved\" values and score: 0 so the client can handle it.",
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
    role: normalizeBeatRole(beat.label),
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

  return {
    profiles,
    beats: toBeatSegments(parsed.narrative.beats, parsed.narrative.devices),
    axisDetails,
    diagnostics: {
      fromFallback: result.fromFallback,
      unobservedCounts: collectUnobservedCounts(parsed),
      rawStatus: result.status,
    },
  };
};
