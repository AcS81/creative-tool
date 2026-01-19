export type AnalysisErrorType =
  | "structure"
  | "core"
  | "advanced"
  | "derived"
  | "gemini"
  | "timeout"
  | "validation";

export type RetryConfig = {
  maxRetries: number;
  backoffMs: number;
  timeoutMs?: number;
};

export class AnalysisError extends Error {
  readonly type: AnalysisErrorType;
  readonly recoverable: boolean;
  readonly fallbackAvailable: boolean;

  constructor(input: {
    type: AnalysisErrorType;
    message: string;
    recoverable: boolean;
    fallbackAvailable: boolean;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = "AnalysisError";
    this.type = input.type;
    this.recoverable = input.recoverable;
    this.fallbackAvailable = input.fallbackAvailable;
    if (input.cause !== undefined) {
      (this as { cause?: unknown }).cause = input.cause;
    }
    Object.setPrototypeOf(this, AnalysisError.prototype);
  }
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const withTimeout = async <T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T> => {
  if (!timeoutMs || timeoutMs <= 0) {
    return fn();
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new AnalysisError({
          type: "timeout",
          message: `Timeout after ${timeoutMs}ms`,
          recoverable: true,
          fallbackAvailable: false,
        }),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const withRetry = async <T>(fn: () => Promise<T>, config: RetryConfig): Promise<T | null> => {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= config.maxRetries) {
    try {
      return await withTimeout(fn, config.timeoutMs);
    } catch (error) {
      lastError = error;
      if (error instanceof AnalysisError && !error.recoverable) {
        break;
      }
      if (attempt === config.maxRetries) {
        break;
      }
      const backoff = config.backoffMs * Math.pow(2, attempt);
      await delay(backoff);
    }
    attempt += 1;
  }

  if (lastError instanceof AnalysisError && lastError.type === "timeout") {
    return null;
  }

  return null;
};

export const RETRY_CONFIGS: Record<"structure" | "core" | "advanced", RetryConfig> = {
  structure: { maxRetries: 2, backoffMs: 1000 },
  core: { maxRetries: 1, backoffMs: 500 },
  advanced: { maxRetries: 1, backoffMs: 500 },
};
