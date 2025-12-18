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
const parsePositiveInt = (raw: string | undefined, fallback: number) => {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

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
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const text = parts
      .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
    if (text) return text;
  }

  const directText = typeof payload?.text === "string" ? payload.text.trim() : "";
  return directText.length > 0 ? directText : null;
};

const describeBlockReason = (payload: any): string | null => {
  const blockReason = payload?.promptFeedback?.blockReason || payload?.candidates?.[0]?.finishReason;
  if (!blockReason) return null;
  const safety =
    payload?.promptFeedback?.safetyRatings || payload?.candidates?.[0]?.safetyRatings || [];
  const categories = Array.isArray(safety)
    ? safety
        .map((rating: any) => {
          const category = rating?.category;
          const probability = rating?.probability;
          if (!category || !probability) return null;
          const shortCategory = String(category).split("/").pop() ?? category;
          return `${shortCategory}:${probability}`;
        })
        .filter(Boolean)
        .join(", ")
    : "";
  return categories ? `${blockReason} (${categories})` : blockReason;
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
    const block = describeBlockReason(payload);
    const message = block
      ? `Gemini did not return content (block reason: ${block}).`
      : "Gemini API response missing text candidate.";
    throw new GeminiApiError("InvalidResponse", message, response.status, payload);
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
const FALLBACK_DOWNLOAD_TIMEOUT_MS = parsePositiveInt(process.env.GEMINI_FALLBACK_DOWNLOAD_TIMEOUT_MS, 20000);
const MULTIMODAL_TIMEOUT_MS = parsePositiveInt(process.env.GEMINI_MULTIMODAL_TIMEOUT_MS, 180000);

const withTimeoutSignal = (parent: AbortSignal | undefined, timeoutMs: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const abortFromParent = () => controller.abort();
  if (parent) {
    if (parent.aborted) {
      controller.abort();
    } else {
      parent.addEventListener("abort", abortFromParent, { once: true });
    }
  }

  const cleanup = () => {
    clearTimeout(timer);
    if (parent) {
      parent.removeEventListener("abort", abortFromParent);
    }
  };

  return { signal: controller.signal, cleanup };
};
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
    const block = describeBlockReason(payload);
    return {
      ok: false,
      errorMessage: block
        ? `Gemini did not return content (block reason: ${block}).`
        : "Gemini response missing text candidate.",
    };
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
  const generationConfig: Record<string, unknown> = {
    temperature: 0.2,
    responseMimeType: "application/json",
  };

  if (input.jsonSchema) {
    generationConfig.responseSchema = input.jsonSchema;
  }

  const body: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [input.videoPart, { text: input.prompt }],
      },
    ],
    generationConfig,
  };

  if (input.systemInstruction) {
    body.systemInstruction = {
      role: "system",
      parts: [{ text: input.systemInstruction }],
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

const downloadVideoSample = async (
  youtubeUrl: string,
  signal?: AbortSignal,
  logger?: Logger,
): Promise<Buffer> => {
  const { signal: guardedSignal, cleanup } = withTimeoutSignal(signal, FALLBACK_DOWNLOAD_TIMEOUT_MS);
  const started = Date.now();
  try {
    const response = await fetch(youtubeUrl, {
      headers: { Range: `bytes=0-${FALLBACK_MAX_BYTES - 1}` },
      signal: guardedSignal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch media sample, status ${response.status}`);
    }

    const contentType = response.headers?.get?.("content-type")?.toLowerCase() ?? "";
    if (contentType.includes("text/html")) {
      throw new Error("Fallback download returned HTML, not media bytes.");
    }

    const readBuffer = async (): Promise<Buffer> => {
      if (!response.body || typeof response.body.getReader !== "function") {
        const buffer = Buffer.from(await response.arrayBuffer());
        const clamped = buffer.subarray(0, Math.min(buffer.length, FALLBACK_MAX_BYTES));
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

      return Buffer.concat(chunks, received);
    };

    const buffer = await readBuffer();
    if (buffer.length === 0) {
      throw new Error("Media fetch returned empty body.");
    }

    const sniff = buffer.subarray(0, 128).toString("utf8").toLowerCase();
    if (sniff.includes("<!doctype html") || sniff.includes("<html")) {
      throw new Error("Fallback download returned HTML content.");
    }

    const elapsed = Date.now() - started;
    if (elapsed > FALLBACK_DOWNLOAD_TIMEOUT_MS) {
      throw new Error(`Fallback media fetch exceeded ${FALLBACK_DOWNLOAD_TIMEOUT_MS}ms.`);
    }

    return buffer;
  } finally {
    cleanup();
    logger?.info?.(`Fallback fetch elapsed ${Date.now() - started}ms`);
  }
};

const prepareFallbackUpload = async (
  youtubeUrl: string,
  signal?: AbortSignal,
  logger?: Logger,
): Promise<TempUploadHandle> => {
  const mediaBuffer = await downloadVideoSample(youtubeUrl, signal, logger);
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

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

const shouldRetryOutcome = (outcome: GeminiCallOutcome): boolean => {
  if (outcome.ok) return false;
  if (outcome.status && RETRYABLE_STATUSES.has(outcome.status)) return true;
  const message = outcome.errorMessage?.toLowerCase() ?? "";
  return message.includes("overloaded") || message.includes("unavailable") || message.includes("temporarily");
};

const shouldForceFallbackOnOverload = (outcome: GeminiCallOutcome): boolean => {
  if (outcome.ok) return false;
  if (outcome.shouldFallback) return true;
  if (outcome.status && RETRYABLE_STATUSES.has(outcome.status)) return true;
  const message = outcome.errorMessage?.toLowerCase() ?? "";
  return message.includes("overloaded") || message.includes("unavailable") || message.includes("temporarily");
};

const waitWithBackoff = async (attempt: number, signal?: AbortSignal) => {
  const base = 400;
  const cap = 4000;
  const delay = Math.min(base * 2 ** attempt, cap) + Math.floor(Math.random() * 150);
  if (signal?.aborted) throw new Error("Aborted");
  await new Promise((resolve) => setTimeout(resolve, delay));
  if (signal?.aborted) throw new Error("Aborted");
};

const MAX_CONCURRENT_GEMINI = parsePositiveInt(process.env.GEMINI_MAX_CONCURRENCY, 1);
const geminiQueue: Array<() => void> = [];
let geminiInFlight = 0;

const acquireGeminiSlot = async () =>
  new Promise<void>((resolve) => {
    if (geminiInFlight < MAX_CONCURRENT_GEMINI) {
      geminiInFlight += 1;
      resolve();
      return;
    }
    geminiQueue.push(() => {
      geminiInFlight += 1;
      resolve();
    });
  });

const releaseGeminiSlot = () => {
  geminiInFlight = Math.max(0, geminiInFlight - 1);
  const next = geminiQueue.shift();
  if (next) next();
};

const withGeminiSlot = async <T>(fn: () => Promise<T>): Promise<T> => {
  await acquireGeminiSlot();
  try {
    return await fn();
  } finally {
    releaseGeminiSlot();
  }
};

/**
 * Runs a single multimodal Gemini call using `file_data` for the YouTube URL.
 * Falls back once to a temporary inline upload if the primary path is rejected (403/unsupported).
 */
export const callGeminiMultimodalJson = async (
  request: GeminiMultimodalRequest,
): Promise<GeminiMultimodalResult> => {
  const config = request.config ?? getAppConfig();
  const logger = request.logger ?? console;
  const forceFallbackRequested = request.forceFallback === true;
  const { signal: requestSignal, cleanup: cleanupRequestTimeout } = withTimeoutSignal(
    request.signal,
    MULTIMODAL_TIMEOUT_MS,
  );

  try {
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

    const callWithRetries = async (
      label: string,
      fn: () => Promise<GeminiCallOutcome>,
    ): Promise<GeminiCallOutcome> => {
      const maxAttempts = 3;
      let attempt = 0;
      let lastOutcome: GeminiCallOutcome | undefined;

      while (attempt < maxAttempts) {
        lastOutcome = await fn();
        if (!shouldRetryOutcome(lastOutcome)) {
          return lastOutcome;
        }

        attempt += 1;
        if (attempt >= maxAttempts) {
          const errorMessage = lastOutcome.errorMessage
            ? `${lastOutcome.errorMessage} (after ${maxAttempts} attempts)`
            : `Gemini unavailable after ${maxAttempts} attempts`;
          return { ...lastOutcome, errorMessage };
        }

        logger.warn(
          `Gemini ${label} attempt ${attempt} failed (status ${lastOutcome.status ?? "unknown"}); retrying...`,
        );
        await waitWithBackoff(attempt, requestSignal);
      }

      return lastOutcome as GeminiCallOutcome;
    };

    const attemptFallback = async (): Promise<GeminiMultimodalResult> => {
      logger.warn("Using inline_data fallback path for Gemini multimodal call.");

      let upload: TempUploadHandle | undefined;
      try {
        upload = await prepareFallbackUpload(request.youtubeUrl, requestSignal, logger);
      } catch (error) {
        logger.error("Failed to prepare fallback upload", error);
        return toFallbackFailed(describeError(error));
      }

      try {
        const fallbackOutcome = await callWithRetries("fallback inline_data", () =>
          withGeminiSlot(() =>
            callGeminiWithVideoPart({
              apiKey,
              videoPart: upload.part,
              prompt: request.prompt,
              jsonSchema: request.jsonSchema,
              systemInstruction: request.systemInstruction,
              signal: requestSignal,
            }),
          ),
        );

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

    if (forceFallbackRequested) {
      return attemptFallback();
    }

    const primaryOutcome = await callWithRetries("primary file_data", () =>
      withGeminiSlot(() =>
        callGeminiWithVideoPart({
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
          signal: requestSignal,
        }),
      ),
    );

    if (primaryOutcome.ok) {
      return {
        ok: true,
        fromFallback: false,
        rawJson: primaryOutcome.data,
        status: primaryOutcome.status,
      };
    }

    const message =
      primaryOutcome.errorMessage ||
      "Gemini returned an error before fallback could be attempted.";

    if (primaryOutcome.shouldFallback || shouldForceFallbackOnOverload(primaryOutcome) || forceFallbackRequested) {
      logger.warn(
        `Gemini file_data path returned ${primaryOutcome.status ?? "unknown"}; forcing fallback inline upload.`,
      );
      return attemptFallback();
    }

    if (primaryOutcome.status && primaryOutcome.status >= 200 && primaryOutcome.status < 300) {
      return toInvalidResponse(message, primaryOutcome.status);
    }
    return toUpstreamError(message, primaryOutcome.status);
  } finally {
    cleanupRequestTimeout();
  }
};
