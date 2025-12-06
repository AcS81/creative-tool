import { z } from "zod";
import { ConfigError, getAppConfig, type AppConfig } from "../config";
import type { SceneSegment, TranscriptSegment } from "../types";

export type GeminiTranscriptResult = {
  transcriptSegments: TranscriptSegment[];
  sceneSegments: SceneSegment[];
};

export type GeminiErrorType = "UpstreamError" | "InvalidResponse";

export class GeminiApiError extends Error {
  readonly type: GeminiErrorType;
  readonly status?: number;
  readonly details?: unknown;

  constructor(type: GeminiErrorType, message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "GeminiApiError";
    this.type = type;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, GeminiApiError.prototype);
  }
}

const segmentBaseSchema = z.object({
  startSeconds: z.number().min(0),
  endSeconds: z.number().min(0),
});

const transcriptSegmentSchema = segmentBaseSchema.extend({
  text: z.string().min(1),
});

const sceneSegmentSchema = segmentBaseSchema.extend({
  label: z.string().min(1),
  shortSummary: z.string().min(1),
});

const responseSchema = z.object({
  transcriptSegments: z.array(transcriptSegmentSchema).min(1, "at least one transcript segment"),
  sceneSegments: z.array(sceneSegmentSchema).min(1, "at least one scene segment"),
});

type GetTranscriptAndScenesOptions = {
  config?: AppConfig;
};

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent";

const buildPrompt = (videoUrl: string) =>
  [
    "You are a concise video analyst.",
    "Given a YouTube URL, produce ONLY valid JSON with transcriptSegments and sceneSegments.",
    "Do not include any prose or markdown.",
    "Shapes:",
    `{"transcriptSegments":[{"startSeconds":0,"endSeconds":8,"text":"..."}],"sceneSegments":[{"startSeconds":0,"endSeconds":30,"label":"Intro","shortSummary":"..."}]}`,
    "Guidelines:",
    "- 8–40 transcript segments total; keep text concise.",
    "- 3–10 scene segments total; coarse logical sections with short labels.",
    "- Time values in seconds (numbers).",
    `Video URL: ${videoUrl}`,
  ].join("\n");

const extractTextCandidate = (payload: any): string | null => {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part: any) => part?.text || "")
    .join("")
    .trim();
  return text && text.length > 0 ? text : null;
};

export async function getTranscriptAndScenes(
  input: { videoUrl: string },
  options: GetTranscriptAndScenesOptions = {},
): Promise<GeminiTranscriptResult> {
  const config = options.config ?? getAppConfig();
  const apiKey = config.geminiApiKey;
  if (!apiKey) {
    throw new ConfigError("GEMINI_API_KEY is not set.");
  }

  const prompt = buildPrompt(input.videoUrl);
  const url = `${GEMINI_ENDPOINT}?key=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
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

  const validated = responseSchema.safeParse(parsed);
  if (!validated.success) {
    const message = validated.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new GeminiApiError("InvalidResponse", `Gemini response validation failed: ${message}`);
  }

  return validated.data;
}
