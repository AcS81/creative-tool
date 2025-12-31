export type AnalysisMode = "mock" | "gemini";
export type AnalysisVersion = "v1" | "v2";
export type MultimodalPassMode = "core" | "full";

export type AppConfig = {
  analysisMode: AnalysisMode;
  analysisVersion: AnalysisVersion;
  geminiApiKey?: string;
  youtubeApiKey?: string;
  performanceEnabled: boolean;
  advancedMetricsEnabled: boolean;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUrl?: string;
  tokenEncryptionKey?: string;
  analysisV2MultimodalEnabled: boolean;
  multimodalPassMode?: MultimodalPassMode;
  geminiMultimodalCoreModel?: string;
  geminiMultimodalAdvancedAudioModel?: string;
  geminiMultimodalAdvancedVisualModel?: string;
  geminiMultimodalSalvageModel?: string;
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

const normalizeAnalysisVersion = (raw?: string | null): AnalysisVersion | undefined => {
  if (!raw) return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "v1" || normalized === "1") return "v1";
  if (normalized === "v2" || normalized === "2") return "v2";
  return undefined;
};

const normalizePassMode = (raw?: string | null): MultimodalPassMode | undefined => {
  if (!raw) return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "core") return "core";
  if (normalized === "full") return "full";
  return undefined;
};

const parseBoolean = (raw?: string | null) => {
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

export const getAppConfig = (): AppConfig => {
  const analysisMode = normalizeAnalysisMode(process.env.ANALYSIS_MODE);
  const analysisVersionFromEnv = normalizeAnalysisVersion(process.env.ANALYSIS_VERSION);
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  const performanceEnabled = parseBoolean(process.env.ENABLE_PERFORMANCE);
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const googleRedirectUrl = process.env.GOOGLE_REDIRECT_URL;
  const tokenEncryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
  const rawMultimodalFlag = process.env.ENABLE_ANALYSIS_V2_MULTIMODAL;
  const analysisV2MultimodalFlag =
    typeof rawMultimodalFlag === "string" ? parseBoolean(rawMultimodalFlag) : undefined;
  const rawAdvancedMetricsFlag = process.env.ENABLE_ADVANCED_METRICS;
  const advancedMetricsFlag =
    typeof rawAdvancedMetricsFlag === "string" ? parseBoolean(rawAdvancedMetricsFlag) : undefined;
  const passModeFromEnv = normalizePassMode(process.env.MULTIMODAL_PASS_MODE);
  const geminiMultimodalCoreModel = process.env.GEMINI_MULTIMODAL_CORE_MODEL;
  const geminiMultimodalAdvancedAudioModel = process.env.GEMINI_MULTIMODAL_ADV_AUDIO_MODEL;
  const geminiMultimodalAdvancedVisualModel = process.env.GEMINI_MULTIMODAL_ADV_VISUAL_MODEL;
  const geminiMultimodalSalvageModel = process.env.GEMINI_MULTIMODAL_SALVAGE_MODEL;

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

  const geminiConfigured = analysisMode === "gemini" && Boolean(geminiApiKey) && Boolean(youtubeApiKey);
  const defaultMultimodalEnabled = geminiConfigured;
  const defaultAdvancedMetricsEnabled = geminiConfigured;

  let analysisVersion: AnalysisVersion;
  let analysisV2MultimodalEnabled: boolean;
  if (analysisVersionFromEnv) {
    analysisVersion = analysisVersionFromEnv;
    analysisV2MultimodalEnabled = analysisVersionFromEnv === "v2";
  } else if (typeof analysisV2MultimodalFlag === "boolean") {
    analysisV2MultimodalEnabled = analysisV2MultimodalFlag;
    analysisVersion = analysisV2MultimodalFlag ? "v2" : "v1";
  } else {
    analysisV2MultimodalEnabled = defaultMultimodalEnabled;
    analysisVersion = analysisV2MultimodalEnabled ? "v2" : "v1";
  }

  const advancedMetricsEnabledRaw =
    typeof advancedMetricsFlag === "boolean" ? advancedMetricsFlag : defaultAdvancedMetricsEnabled;
  const multimodalPassMode: MultimodalPassMode =
    passModeFromEnv ?? (advancedMetricsEnabledRaw ? "full" : "core");
  const advancedMetricsEnabled = multimodalPassMode === "core" ? false : advancedMetricsEnabledRaw;

  return {
    analysisMode,
    analysisVersion,
    geminiApiKey,
    youtubeApiKey,
    performanceEnabled,
    advancedMetricsEnabled,
    googleClientId,
    googleClientSecret,
    googleRedirectUrl,
    tokenEncryptionKey,
    analysisV2MultimodalEnabled,
    multimodalPassMode,
    geminiMultimodalCoreModel,
    geminiMultimodalAdvancedAudioModel,
    geminiMultimodalAdvancedVisualModel,
    geminiMultimodalSalvageModel,
  };
};
