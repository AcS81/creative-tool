export type AnalysisMode = "mock" | "gemini";

export type AppConfig = {
  analysisMode: AnalysisMode;
  geminiApiKey?: string;
  youtubeApiKey?: string;
};

export class ConfigError extends Error {
  code = "MisconfiguredEnvironment" as const;
  missingKeys: string[];

  constructor(message: string, missingKeys: string[] = []) {
    super(message);
    this.name = "ConfigError";
    this.missingKeys = missingKeys;
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

const normalizeAnalysisMode = (raw?: string | null): AnalysisMode => {
  if (!raw) return "mock";
  return raw.toLowerCase() === "gemini" ? "gemini" : "mock";
};

export const getAppConfig = (): AppConfig => {
  const analysisMode = normalizeAnalysisMode(process.env.ANALYSIS_MODE);
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;

  if (analysisMode === "gemini") {
    const missingKeys = [!geminiApiKey && "GEMINI_API_KEY", !youtubeApiKey && "YOUTUBE_API_KEY"].filter(
      Boolean,
    ) as string[];

    if (missingKeys.length > 0) {
      throw new ConfigError(
        `Missing required environment variables for ANALYSIS_MODE=gemini: ${missingKeys.join(", ")}`,
        missingKeys,
      );
    }
  }

  return {
    analysisMode,
    geminiApiKey,
    youtubeApiKey,
  };
};
