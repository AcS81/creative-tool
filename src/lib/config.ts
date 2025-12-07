export type AnalysisMode = "mock" | "gemini";

export type AppConfig = {
  analysisMode: AnalysisMode;
  geminiApiKey?: string;
  youtubeApiKey?: string;
  performanceEnabled: boolean;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUrl?: string;
  tokenEncryptionKey?: string;
  analysisV2MultimodalEnabled: boolean;
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

const parseBoolean = (raw?: string | null) => {
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

export const getAppConfig = (): AppConfig => {
  const analysisMode = normalizeAnalysisMode(process.env.ANALYSIS_MODE);
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  const performanceEnabled = parseBoolean(process.env.ENABLE_PERFORMANCE);
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const googleRedirectUrl = process.env.GOOGLE_REDIRECT_URL;
  const tokenEncryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
  const analysisV2MultimodalEnabled = parseBoolean(process.env.ENABLE_ANALYSIS_V2_MULTIMODAL);

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

  if (performanceEnabled) {
    const missingKeys = [
      !googleClientId && "GOOGLE_CLIENT_ID",
      !googleClientSecret && "GOOGLE_CLIENT_SECRET",
      !googleRedirectUrl && "GOOGLE_REDIRECT_URL",
      !tokenEncryptionKey && "TOKEN_ENCRYPTION_KEY",
    ].filter(Boolean) as string[];
    if (missingKeys.length > 0) {
      throw new ConfigError(
        `Missing required environment variables for ENABLE_PERFORMANCE=true: ${missingKeys.join(", ")}`,
        missingKeys,
      );
    }
  }

  return {
    analysisMode,
    geminiApiKey,
    youtubeApiKey,
    performanceEnabled,
    googleClientId,
    googleClientSecret,
    googleRedirectUrl,
    tokenEncryptionKey,
    analysisV2MultimodalEnabled,
  };
};
