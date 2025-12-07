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

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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
    const msg =
      response.status === 404
        ? `Gemini API returned 404 for model "${GEMINI_MODEL}". Check GEMINI_MODEL, API enablement, and key access.`
        : `Gemini API returned ${response.status}`;
    throw new GeminiApiError("UpstreamError", msg, response.status);
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

type Logger = Pick<typeof console, "warn" | "error" | "info">;

const DEFAULT_VIDEO_MIME_TYPE = "video/mp4";
const FALLBACK_MAX_BYTES = 5 * 1024 * 1024; // 5 MB sample to keep temp files small
export type GeminiMultimodalErrorCode =
  | "FEATURE_DISABLED"
  | "CONFIG_MISSING"
  | "INVALID_URL"
  | "UPSTREAM_ERROR"
  | "INVALID_RESPONSE"
  | "FALLBACK_FAILED";

export type GeminiMultimodalResult =
  | { ok: true; fromFallback: boolean; rawJson: unknown; status: number }
  | { ok: false; errorCode: GeminiMultimodalErrorCode; errorMessage: string; status?: number };

export type GeminiMultimodalRequest = {
  youtubeUrl: string;
  prompt: string;
  jsonSchema?: unknown;
  systemInstruction?: string;
  signal?: AbortSignal;
  config?: AppConfig;
  logger?: Logger;
  /**
   * Forces the client on even if ANALYSIS_MODE is mock or the feature flag is off.
   * Useful for tests and local development when you want to exercise the request builder.
   */
  forceEnable?: boolean;
  /**
   * Dev-only: skip the primary file_data path and run the inline fallback directly.
   * Useful for validating whether the fetched bytes look like media vs HTML.
   */
  forceFallback?: boolean;
};

type GeminiVideoPart =
  | {
      file_data: {
        mime_type: string;
        file_uri: string;
      };
    }
  | {
      inline_data: {
        mime_type: string;
        data: string;
      };
    };

type GeminiCallOutcome =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status?: number; errorMessage?: string; shouldFallback?: boolean };

type TempUploadHandle = {
  part: GeminiVideoPart;
  cleanup: () => Promise<void>;
};

export const isMultimodalClientEnabled = (config: AppConfig = getAppConfig()) =>
  Boolean(config.analysisV2MultimodalEnabled);

const isValidYoutubeUrl = (raw: string): boolean => {
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    return (
      host === "youtu.be" ||
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host.endsWith(".youtube-nocookie.com")
    );
  } catch {
    return false;
  }
};

const parseCandidateJson = (payload: any): { ok: boolean; data?: unknown; errorMessage?: string } => {
  const candidateText = extractTextCandidate(payload);
  if (!candidateText) {
    return { ok: false, errorMessage: "Gemini response missing text candidate." };
  }

  try {
    return { ok: true, data: JSON.parse(candidateText) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gemini response could not be parsed as JSON.";
    return { ok: false, errorMessage: message };
  }
};

const buildMultimodalBody = (input: {
  videoPart: GeminiVideoPart;
  prompt: string;
  jsonSchema?: unknown;
  systemInstruction?: string;
}) => {
  const body: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [input.videoPart, { text: input.prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  };

  if (input.systemInstruction) {
    body.systemInstruction = {
      role: "system",
      parts: [{ text: input.systemInstruction }],
    };
  }

  if (input.jsonSchema) {
    body.generationConfig = {
      ...(body.generationConfig as Record<string, unknown>),
      responseSchema: input.jsonSchema,
    };
  }

  return body;
};

const callGemini = async (input: {
  apiKey: string;
  body: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<{ ok: boolean; status?: number; payload?: any; errorMessage?: string }> => {
  const url = `${GEMINI_ENDPOINT}?key=${input.apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.body),
      signal: input.signal,
    });

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const errorMessage =
        payload?.error?.message || `Gemini API returned ${response.status || "unknown status"}`;
      return { ok: false, status: response.status, payload, errorMessage };
    }

    return { ok: true, status: response.status, payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reach Gemini API.";
    return { ok: false, status: undefined, errorMessage: message };
  }
};

const isFileDataEntitlementError = (status?: number, message?: string) => {
  if (!status) return false;
  if (status === 403) return true;
  if (status === 400 && message) {
    return message.toLowerCase().includes("file_data") || message.toLowerCase().includes("file data");
  }
  return false;
};

const callGeminiWithVideoPart = async (input: {
  apiKey: string;
  videoPart: GeminiVideoPart;
  prompt: string;
  jsonSchema?: unknown;
  systemInstruction?: string;
  signal?: AbortSignal;
}): Promise<GeminiCallOutcome> => {
  const response = await callGemini({
    apiKey: input.apiKey,
    body: buildMultimodalBody({
      videoPart: input.videoPart,
      prompt: input.prompt,
      jsonSchema: input.jsonSchema,
      systemInstruction: input.systemInstruction,
    }),
    signal: input.signal,
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      errorMessage: response.errorMessage,
      shouldFallback: isFileDataEntitlementError(response.status, response.errorMessage),
    };
  }

  const parsed = parseCandidateJson(response.payload);
  if (!parsed.ok) {
    return {
      ok: false,
      status: response.status,
      errorMessage: parsed.errorMessage || "Gemini returned an invalid JSON payload.",
      shouldFallback: false,
    };
  }

  return {
    ok: true,
    status: response.status ?? 200,
    data: parsed.data,
  };
};

const downloadVideoSample = async (youtubeUrl: string, signal?: AbortSignal): Promise<Buffer> => {
  const response = await fetch(youtubeUrl, {
    headers: { Range: `bytes=0-${FALLBACK_MAX_BYTES - 1}` },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch media sample, status ${response.status}`);
  }

  if (!response.body || typeof response.body.getReader !== "function") {
    const buffer = Buffer.from(await response.arrayBuffer());
    const clamped = buffer.subarray(0, Math.min(buffer.length, FALLBACK_MAX_BYTES));
    if (clamped.length === 0) {
      throw new Error("Media fetch returned empty body.");
    }
    return Buffer.from(clamped);
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let received = 0;

  while (received < FALLBACK_MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    const allowed = Math.min(value.length, FALLBACK_MAX_BYTES - received);
    chunks.push(Buffer.from(value.subarray(0, allowed)));
    received += allowed;
    if (received >= FALLBACK_MAX_BYTES) {
      try {
        await reader.cancel();
      } catch {
        // ignore cancellation errors
      }
      break;
    }
  }

  if (received === 0) {
    throw new Error("No media bytes received from YouTube URL.");
  }

  return Buffer.concat(chunks, received);
};

const prepareFallbackUpload = async (
  youtubeUrl: string,
  signal?: AbortSignal,
  logger?: Logger,
): Promise<TempUploadHandle> => {
  const mediaBuffer = await downloadVideoSample(youtubeUrl, signal);
  logger?.info?.(`Fallback media sample fetched: ${mediaBuffer.byteLength} bytes`);

  const cleanup = async () => {
    try {
      mediaBuffer.fill(0);
    } catch {
      // noop
    }
  };

  return {
    part: {
      inline_data: {
        mime_type: DEFAULT_VIDEO_MIME_TYPE,
        data: mediaBuffer.toString("base64"),
      },
    },
    cleanup,
  };
};

const toInvalidUrl = (url: string): GeminiMultimodalResult => ({
  ok: false,
  errorCode: "INVALID_URL",
  errorMessage: `Invalid YouTube URL: ${url}`,
});

const toConfigMissing = (message: string): GeminiMultimodalResult => ({
  ok: false,
  errorCode: "CONFIG_MISSING",
  errorMessage: message,
});

const toUpstreamError = (message: string, status?: number): GeminiMultimodalResult => ({
  ok: false,
  errorCode: "UPSTREAM_ERROR",
  errorMessage: message,
  status,
});

const toInvalidResponse = (message: string, status?: number): GeminiMultimodalResult => ({
  ok: false,
  errorCode: "INVALID_RESPONSE",
  errorMessage: message,
  status,
});

const toFallbackFailed = (message: string): GeminiMultimodalResult => ({
  ok: false,
  errorCode: "FALLBACK_FAILED",
  errorMessage: message,
});

const describeError = (error: unknown) => (error instanceof Error ? error.message : "Unknown error");

/**
 * Runs a single multimodal Gemini call using `file_data` for the YouTube URL.
 * Falls back once to a temporary inline upload if the primary path is rejected (403/unsupported).
 */
export const callGeminiMultimodalJson = async (
  request: GeminiMultimodalRequest,
): Promise<GeminiMultimodalResult> => {
  const config = request.config ?? getAppConfig();
  const logger = request.logger ?? console;

  if (!request.forceEnable && !isMultimodalClientEnabled(config)) {
    return {
      ok: false,
      errorCode: "FEATURE_DISABLED",
      errorMessage: "analysis_v2_multimodal flag is disabled.",
    };
  }

  if (!request.forceEnable && config.analysisMode === "mock") {
    return {
      ok: false,
      errorCode: "FEATURE_DISABLED",
      errorMessage: "Gemini calls are disabled while ANALYSIS_MODE=mock.",
    };
  }

  if (!isValidYoutubeUrl(request.youtubeUrl)) {
    return toInvalidUrl(request.youtubeUrl);
  }

  const apiKey = config.geminiApiKey;
  if (!apiKey) {
    return toConfigMissing("GEMINI_API_KEY is not set.");
  }

  const attemptFallback = async (): Promise<GeminiMultimodalResult> => {
    logger.warn("Using inline_data fallback path for Gemini multimodal call.");

    let upload: TempUploadHandle | undefined;
    try {
      upload = await prepareFallbackUpload(request.youtubeUrl, request.signal, logger);
    } catch (error) {
      logger.error("Failed to prepare fallback upload", error);
      return toFallbackFailed(describeError(error));
    }

    try {
      const fallbackOutcome = await callGeminiWithVideoPart({
        apiKey,
        videoPart: upload.part,
        prompt: request.prompt,
        jsonSchema: request.jsonSchema,
        systemInstruction: request.systemInstruction,
        signal: request.signal,
      });

      if (fallbackOutcome.ok) {
        return {
          ok: true,
          fromFallback: true,
          rawJson: fallbackOutcome.data,
          status: fallbackOutcome.status,
        };
      }

      const message =
        fallbackOutcome.errorMessage ||
        "Gemini returned an error while using the fallback inline upload.";
      if (fallbackOutcome.status && fallbackOutcome.status >= 200 && fallbackOutcome.status < 300) {
        return toInvalidResponse(message, fallbackOutcome.status);
      }
      return toUpstreamError(message, fallbackOutcome.status);
    } finally {
      if (upload) {
        await upload.cleanup();
      }
    }
  };

  if (request.forceFallback) {
    return attemptFallback();
  }

  const primaryOutcome = await callGeminiWithVideoPart({
    apiKey,
    videoPart: {
      file_data: {
        mime_type: DEFAULT_VIDEO_MIME_TYPE,
        file_uri: request.youtubeUrl,
      },
    },
    prompt: request.prompt,
    jsonSchema: request.jsonSchema,
    systemInstruction: request.systemInstruction,
    signal: request.signal,
  });

  if (primaryOutcome.ok) {
    return {
      ok: true,
      fromFallback: false,
      rawJson: primaryOutcome.data,
      status: primaryOutcome.status,
    };
  }

  if (!primaryOutcome.shouldFallback) {
    const message =
      primaryOutcome.errorMessage ||
      "Gemini returned an error before fallback could be attempted.";
    if (primaryOutcome.status && primaryOutcome.status >= 200 && primaryOutcome.status < 300) {
      return toInvalidResponse(message, primaryOutcome.status);
    }
    return toUpstreamError(message, primaryOutcome.status);
  }

  logger.warn("Gemini file_data path rejected; attempting temp upload fallback.");
  return attemptFallback();
};
