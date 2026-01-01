import { z } from "zod";
import { ConfigError, getAppConfig, type AppConfig } from "../config";
import type { IngestionPreflight } from "../analysis/types";
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
const getGeminiEndpoint = (modelOverride?: string) => {
  const model = modelOverride || GEMINI_MODEL;
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
};
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
  const url = `${getGeminiEndpoint()}?key=${apiKey}`;

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
  | "INVALID_RESPONSE";

export type GeminiUsage = {
  promptTokens?: number;
  candidateTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
};

export type GeminiRequestMetrics = {
  durationMs: number;
  attempts: number;
  retries: number;
  status?: number;
  model?: string;
  usage?: GeminiUsage;
  estimatedCostUsd?: number;
};

export type GeminiMultimodalResult =
  | { ok: true; rawJson: unknown; status: number; metrics?: GeminiRequestMetrics }
  | {
      ok: false;
      errorCode: GeminiMultimodalErrorCode;
      errorMessage: string;
      status?: number;
      metrics?: GeminiRequestMetrics;
    };

export type GeminiMultimodalRequest = {
  youtubeUrl: string;
  prompt: string;
  jsonSchema?: unknown;
  systemInstruction?: string;
  signal?: AbortSignal;
  config?: AppConfig;
  logger?: Logger;
  model?: string;
  /**
   * Forces the client on even if ANALYSIS_MODE is mock or the feature flag is off.
   * Useful for tests and local development when you want to exercise the request builder.
   */
  forceEnable?: boolean;
};

type GeminiVideoPart =
  | {
      file_data: {
        mime_type: string;
        file_uri: string;
      };
    };

type GeminiCallOutcome =
  | { ok: true; status: number; data: unknown; usage?: GeminiUsage }
  | { ok: false; status?: number; errorMessage?: string; usage?: GeminiUsage };

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
  model?: string;
}): Promise<{ ok: boolean; status?: number; payload?: any; errorMessage?: string }> => {
  const url = `${getGeminiEndpoint(input.model)}?key=${input.apiKey}`;

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

export async function callGeminiTextJson(input: {
  prompt: string;
  jsonSchema?: unknown;
  systemInstruction?: string;
  signal?: AbortSignal;
  config?: AppConfig;
  model?: string;
}): Promise<{ rawJson: unknown; status: number }> {
  const config = input.config ?? getAppConfig();
  const apiKey = config.geminiApiKey;
  if (!apiKey) {
    throw new ConfigError("GEMINI_API_KEY is not set.");
  }

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
        parts: [{ text: input.prompt }],
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

  const response = await callGemini({
    apiKey,
    body,
    signal: input.signal,
    model: input.model,
  });

  if (!response.ok) {
    const message = response.errorMessage || "Gemini API returned an error.";
    throw new GeminiApiError("UpstreamError", message, response.status, response.payload);
  }

  const parsed = parseCandidateJson(response.payload);
  if (!parsed.ok) {
    throw new GeminiApiError(
      "InvalidResponse",
      parsed.errorMessage || "Gemini returned invalid JSON content.",
      response.status,
      response.payload,
    );
  }

  return { rawJson: parsed.data, status: response.status ?? 200 };
}

const parseOptionalNumber = (raw: string | undefined) => {
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const COST_PER_1K_INPUT_TOKENS = parseOptionalNumber(process.env.GEMINI_COST_PER_1K_INPUT_TOKENS);
const COST_PER_1K_OUTPUT_TOKENS = parseOptionalNumber(process.env.GEMINI_COST_PER_1K_OUTPUT_TOKENS);
const COST_PER_1K_TOTAL_TOKENS = parseOptionalNumber(process.env.GEMINI_COST_PER_1K_TOKENS);

const PRO_PROMPT_THRESHOLD = 200_000;
const PRICING_PRO_STANDARD = { inputPer1K: 0.00125, outputPer1K: 0.01 };
const PRICING_PRO_LARGE = { inputPer1K: 0.0025, outputPer1K: 0.015 };
const PRICING_FLASH = { inputPer1K: 0.0003, outputPer1K: 0.0025 };
const PRICING_FLASH_LITE = { inputPer1K: 0.0001, outputPer1K: 0.0004 };

const resolveModelPricing = (model: string, usage?: GeminiUsage) => {
  const normalized = model.toLowerCase();
  if (normalized.includes("flash-lite")) return PRICING_FLASH_LITE;
  if (normalized.includes("flash")) return PRICING_FLASH;
  if (normalized.includes("pro")) {
    if (usage?.promptTokens && usage.promptTokens > PRO_PROMPT_THRESHOLD) {
      return PRICING_PRO_LARGE;
    }
    return PRICING_PRO_STANDARD;
  }
  return undefined;
};

const estimateCostUsd = (usage?: GeminiUsage, model?: string): number | undefined => {
  if (!usage) return undefined;
  const promptTokens = usage.promptTokens;
  const candidateTokens = usage.candidateTokens;
  const totalTokens = usage.totalTokens;

  if (COST_PER_1K_INPUT_TOKENS !== undefined && COST_PER_1K_OUTPUT_TOKENS !== undefined) {
    if (promptTokens !== undefined || candidateTokens !== undefined) {
      const input = promptTokens ?? 0;
      const output = candidateTokens ?? 0;
      return (input * COST_PER_1K_INPUT_TOKENS + output * COST_PER_1K_OUTPUT_TOKENS) / 1000;
    }
  }

  if (COST_PER_1K_TOTAL_TOKENS !== undefined && totalTokens !== undefined) {
    return (totalTokens * COST_PER_1K_TOTAL_TOKENS) / 1000;
  }

  const resolvedModel = model ?? GEMINI_MODEL;
  const pricing = resolveModelPricing(resolvedModel, usage);
  if (!pricing) return undefined;

  if (promptTokens !== undefined || candidateTokens !== undefined) {
    const input = promptTokens ?? 0;
    const output = candidateTokens ?? 0;
    return (input * pricing.inputPer1K + output * pricing.outputPer1K) / 1000;
  }

  return undefined;
};

const extractUsageMetadata = (payload: any): GeminiUsage | undefined => {
  const usage = payload?.usageMetadata ?? payload?.usage;
  if (!usage || typeof usage !== "object") return undefined;
  const promptTokens =
    usage.promptTokenCount ?? usage.promptTokens ?? usage.inputTokenCount ?? usage.input_tokens;
  const candidateTokens =
    usage.candidatesTokenCount ??
    usage.candidatesTokens ??
    usage.outputTokenCount ??
    usage.output_tokens;
  const totalTokens = usage.totalTokenCount ?? usage.totalTokens ?? usage.total_tokens;
  const cachedTokens = usage.cachedContentTokenCount ?? usage.cachedTokens ?? usage.cached_tokens;

  const parsed: GeminiUsage = {
    promptTokens: Number.isFinite(promptTokens) ? Number(promptTokens) : undefined,
    candidateTokens: Number.isFinite(candidateTokens) ? Number(candidateTokens) : undefined,
    totalTokens: Number.isFinite(totalTokens) ? Number(totalTokens) : undefined,
    cachedTokens: Number.isFinite(cachedTokens) ? Number(cachedTokens) : undefined,
  };

  return Object.values(parsed).some((value) => value !== undefined) ? parsed : undefined;
};

const callGeminiWithVideoPart = async (input: {
  apiKey: string;
  videoPart: GeminiVideoPart;
  prompt: string;
  jsonSchema?: unknown;
  systemInstruction?: string;
  signal?: AbortSignal;
  model?: string;
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
    model: input.model,
  });

  const usage = extractUsageMetadata(response.payload);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      errorMessage: response.errorMessage,
      usage,
    };
  }

  const parsed = parseCandidateJson(response.payload);
  if (!parsed.ok) {
    return {
      ok: false,
      status: response.status,
      errorMessage: parsed.errorMessage || "Gemini returned an invalid JSON payload.",
      usage,
    };
  }

  return {
    ok: true,
    status: response.status ?? 200,
    data: parsed.data,
    usage,
  };
};

export const preflightGeminiIngestion = async (input: {
  youtubeUrl: string;
  config?: AppConfig;
}): Promise<IngestionPreflight> => {
  const config = input.config ?? getAppConfig();
  const validUrl = isValidYoutubeUrl(input.youtubeUrl);
  const urlIngestionEligible =
    config.analysisMode === "gemini" && isMultimodalClientEnabled(config) && Boolean(config.geminiApiKey);

  let failureMessage: string | undefined;
  if (!validUrl) {
    failureMessage = `Invalid YouTube URL: ${input.youtubeUrl}`;
  } else if (!urlIngestionEligible) {
    failureMessage = "Multimodal ingestion is not enabled or GEMINI_API_KEY is missing.";
  }

  return {
    ok: !failureMessage,
    failureMessage,
    validUrl,
    urlIngestion: {
      eligible: urlIngestionEligible,
    },
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

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

const shouldRetryOutcome = (outcome: GeminiCallOutcome): boolean => {
  if (outcome.ok) return false;
  if (outcome.status && RETRYABLE_STATUSES.has(outcome.status)) return true;
  const message = outcome.errorMessage?.toLowerCase() ?? "";
  return message.includes("overloaded") || message.includes("unavailable") || message.includes("temporarily");
};

const shouldRetryWithoutSchema = (message?: string) => {
  const lower = message?.toLowerCase() ?? "";
  return (
    lower.includes("response_schema") ||
    lower.includes("response schema") ||
    lower.includes("too many states") ||
    lower.includes("schema produces a constraint")
  );
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
 * Runs a single multimodal Gemini call using the YouTube URL (URL-only ingestion).
 */
export const callGeminiMultimodalJson = async (
  request: GeminiMultimodalRequest,
): Promise<GeminiMultimodalResult> => {
  const config = request.config ?? getAppConfig();
  const logger = request.logger ?? console;
  const responseSchemaEnabled = config.geminiResponseSchemaEnabled === true;
  const jsonSchema = responseSchemaEnabled ? request.jsonSchema : undefined;
  const startTime = Date.now();
  let attemptCount = 0;
  let lastUsage: GeminiUsage | undefined;
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
        attemptCount += 1;
        lastOutcome = await fn();
        if (lastOutcome.usage) {
          lastUsage = lastOutcome.usage;
        }
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

    const callWithSchemaFallback = async (
      label: string,
      schema: unknown | undefined,
      buildCall: (schemaOverride: unknown | undefined) => Promise<GeminiCallOutcome>,
    ): Promise<GeminiCallOutcome> => {
      const outcome = await callWithRetries(label, () => buildCall(schema));
      if (outcome.ok || !schema || !shouldRetryWithoutSchema(outcome.errorMessage)) {
        return outcome;
      }
      logger.warn("Gemini response_schema rejected; retrying without responseSchema.");
      return callWithRetries(`${label} (no schema)`, () => buildCall(undefined));
    };

    const primaryOutcome = await callWithSchemaFallback(
      "primary url ingestion",
      jsonSchema,
      (schemaOverride) =>
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
            jsonSchema: schemaOverride,
            systemInstruction: request.systemInstruction,
            signal: requestSignal,
            model: request.model,
          }),
        ),
    );

    const buildMetrics = (status?: number): GeminiRequestMetrics => ({
      durationMs: Date.now() - startTime,
      attempts: attemptCount,
      retries: Math.max(0, attemptCount - 1),
      status,
      model: request.model ?? GEMINI_MODEL,
      usage: lastUsage,
      estimatedCostUsd: estimateCostUsd(lastUsage, request.model ?? GEMINI_MODEL),
    });

    if (primaryOutcome.ok) {
      return {
        ok: true,
        rawJson: primaryOutcome.data,
        status: primaryOutcome.status,
        metrics: buildMetrics(primaryOutcome.status),
      };
    }

    const message =
      primaryOutcome.errorMessage || "Gemini returned an error while ingesting the URL.";

    if (primaryOutcome.status && primaryOutcome.status >= 200 && primaryOutcome.status < 300) {
      return {
        ...toInvalidResponse(message, primaryOutcome.status),
        metrics: buildMetrics(primaryOutcome.status),
      };
    }
    return {
      ...toUpstreamError(message, primaryOutcome.status),
      metrics: buildMetrics(primaryOutcome.status),
    };
  } finally {
    cleanupRequestTimeout();
  }
};
