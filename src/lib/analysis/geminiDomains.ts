import { z } from "zod";
import { ConfigError, getAppConfig, type AppConfig } from "../config";
import type { SceneSegment, TranscriptSegment, DomainProfile } from "../types";
import { GeminiApiError } from "../gemini/client";
import { resolveAxisMetadata } from "./axisMetadata";

type DomainInput = {
  transcriptSegments: TranscriptSegment[];
  sceneSegments: SceneSegment[];
  videoUrl?: string;
};

type DomainDefinition = {
  name: string;
  guidance: string;
  defaultScores?: Array<{ key: string; label: string }>;
};

const domainProfileSchema = z.object({
  primaryArchetype: z.string().min(1),
  secondaryArchetype: z.string().min(1).optional(),
  summaryText: z.string().min(1),
  scores: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        value: z.number().min(0).max(100),
      }),
    )
    .min(3),
  highlights: z.array(z.string().min(1)).optional(),
});

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const truncate = <T>(items: T[], limit = 10): T[] => items.slice(0, limit);

const axis = (id: string) => {
  const meta = resolveAxisMetadata(id);
  return { key: meta?.id ?? id, label: meta?.label ?? id };
};

const buildPrompt = (definition: DomainDefinition, input: DomainInput) => {
  const transcript = truncate(input.transcriptSegments, 12);
  const scenes = truncate(input.sceneSegments, 8);
  const scoreGuidance =
    definition.defaultScores && definition.defaultScores.length > 0
      ? `Use these score keys and labels: ${JSON.stringify(definition.defaultScores)}.`
      : "Provide 3–6 scores that reflect this domain.";

  return [
    `You are analyzing the ${definition.name} domain for a YouTube video.`,
    "Return ONLY valid JSON with this shape (no markdown, no prose):",
    `{"primaryArchetype":"","secondaryArchetype":"","summaryText":"","scores":[{"key":"","label":"","value":50}],"highlights":["..."]}`,
    "Rules:",
    "- scores are numbers 0–100.",
    "- summaryText is 1–2 sentences.",
    "- Use the provided transcriptSegments and sceneSegments as evidence.",
    scoreGuidance,
    `Transcript segments (truncated): ${JSON.stringify(transcript)}`,
    `Scene segments (truncated): ${JSON.stringify(scenes)}`,
    input.videoUrl ? `Video URL: ${input.videoUrl}` : "",
    "Respond with JSON only.",
    `Domain guidance: ${definition.guidance}`,
  ]
    .filter(Boolean)
    .join("\n");
};

const extractTextCandidate = (payload: any): string | null => {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part: any) => part?.text || "")
    .join("")
    .trim();
  return text && text.length > 0 ? text : null;
};

const callGeminiForDomain = async (
  definition: DomainDefinition,
  input: DomainInput,
  options: { config?: AppConfig } = {},
): Promise<DomainProfile> => {
  const config = options.config ?? getAppConfig();
  const apiKey = config.geminiApiKey;
  if (!apiKey) {
    throw new ConfigError("GEMINI_API_KEY is not set.");
  }

  const prompt = buildPrompt(definition, input);
  const url = `${GEMINI_ENDPOINT}?key=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch (error) {
    throw new GeminiApiError("UpstreamError", "Failed to reach Gemini API.", undefined, error);
  }

  if (!response.ok) {
    throw new GeminiApiError(
      "UpstreamError",
      `Gemini API returned ${response.status}`,
      response.status,
    );
  }

  let payload: any;
  try {
    payload = await response.json();
  } catch (error) {
    throw new GeminiApiError("InvalidResponse", "Gemini API returned invalid JSON.", response.status, error);
  }

  const candidateText = extractTextCandidate(payload);
  if (!candidateText) {
    throw new GeminiApiError("InvalidResponse", "Gemini API response missing text candidate.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidateText);
  } catch (error) {
    throw new GeminiApiError("InvalidResponse", "Gemini API returned non-JSON content.", response.status, error);
  }

  const validated = domainProfileSchema.safeParse(parsed);
  if (!validated.success) {
    const message = validated.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new GeminiApiError("InvalidResponse", `Gemini response validation failed: ${message}`);
  }

  return validated.data;
};

const defs: Record<string, DomainDefinition> = {
  voice: {
    name: "Voice",
    guidance: "Assess energy, expressiveness, clarity, warmth, flow/resets.",
    defaultScores: [
      axis("voice.speaking_rate"),
      axis("voice.loudness_range"),
      axis("voice.pitch_variation"),
      axis("voice.clarity"),
      axis("voice.warmth"),
    ],
  },
  language: {
    name: "Language",
    guidance: "Assess abstract vs concrete, story vs explanation, visualizability, example density.",
    defaultScores: [
      axis("language.concreteness"),
      axis("language.story_presence"),
      axis("language.teaching_vs_riffing"),
      axis("language.visualizability"),
    ],
  },
  narrative: {
    name: "Narrative",
    guidance: "Assess hooks, setup/payoff strength, devices like contrast/callback/interrupt.",
    defaultScores: [
      axis("narrative.hooks"),
      axis("narrative.mini_arc_density"),
      axis("narrative.foreshadow_callbacks"),
      axis("narrative.transition_clarity"),
    ],
  },
  visual: {
    name: "Visual",
    guidance: "Assess movement, background stability, facial expression, eye contact style.",
    defaultScores: [
      axis("visual.movement"),
      axis("visual.environment_stability"),
      axis("visual.expression"),
    ],
  },
  editing: {
    name: "Editing",
    guidance: "Assess cut pace, pattern interrupts, transitions, B-roll presence.",
    defaultScores: [
      axis("editing.cut_rate"),
      axis("editing.pattern_interrupts"),
      axis("editing.broll_coverage"),
    ],
  },
  sound: {
    name: "Sound",
    guidance: "Assess music coverage and balance, SFX usage, silence/dead-air handling.",
    defaultScores: [
      axis("sound.music_coverage"),
      axis("sound.music_balance"),
      axis("sound.sfx_density"),
    ],
  },
};

export const analyzeVoice = (input: DomainInput, options?: { config?: AppConfig }) =>
  callGeminiForDomain(defs.voice, input, options);
export const analyzeLanguage = (input: DomainInput, options?: { config?: AppConfig }) =>
  callGeminiForDomain(defs.language, input, options);
export const analyzeNarrative = (input: DomainInput, options?: { config?: AppConfig }) =>
  callGeminiForDomain(defs.narrative, input, options);
export const analyzeVisual = (input: DomainInput, options?: { config?: AppConfig }) =>
  callGeminiForDomain(defs.visual, input, options);
export const analyzeEditing = (input: DomainInput, options?: { config?: AppConfig }) =>
  callGeminiForDomain(defs.editing, input, options);
export const analyzeSound = (input: DomainInput, options?: { config?: AppConfig }) =>
  callGeminiForDomain(defs.sound, input, options);
