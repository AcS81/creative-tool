import { beforeEach, describe, expect, it } from "vitest";
import { ConfigError, getAppConfig } from "./config";

const originalEnv = { ...process.env };

describe("getAppConfig", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ANALYSIS_MODE;
    delete process.env.ANALYSIS_VERSION;
    delete process.env.ENABLE_PERFORMANCE;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URL;
    delete process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.YOUTUBE_API_KEY;
    delete process.env.ENABLE_ANALYSIS_V2_MULTIMODAL;
    delete process.env.ENABLE_ADVANCED_METRICS;
    delete process.env.GEMINI_RESPONSE_SCHEMA_ENABLED;
    delete process.env.ENABLE_STRUCTURE_PASS;
    delete process.env.STRUCTURE_PASS_TIMEOUT_MS;
  });

  it("defaults to mock mode and performance disabled", () => {
    const config = getAppConfig();
    expect(config.analysisMode).toBe("mock");
    expect(config.analysisVersion).toBe("v1");
    expect(config.performanceEnabled).toBe(false);
    expect(config.analysisV2MultimodalEnabled).toBe(false);
    expect(config.advancedMetricsEnabled).toBe(false);
    expect(config.geminiResponseSchemaEnabled).toBe(false);
    expect(config.structurePassEnabled).toBe(true);
    expect(config.structurePassTimeoutMs).toBe(30000);
  });

  it("enables multimodal by default in gemini mode when keys are present", () => {
    process.env.ANALYSIS_MODE = "gemini";
    process.env.GEMINI_API_KEY = "key";
    process.env.YOUTUBE_API_KEY = "yt";

    const config = getAppConfig();
    expect(config.analysisMode).toBe("gemini");
    expect(config.analysisVersion).toBe("v2");
    expect(config.analysisV2MultimodalEnabled).toBe(true);
    expect(config.advancedMetricsEnabled).toBe(true);
  });

  it("requires Gemini keys when ANALYSIS_MODE=gemini", () => {
    process.env.ANALYSIS_MODE = "gemini";
    expect(() => getAppConfig()).toThrow(ConfigError);

    process.env.GEMINI_API_KEY = "key";
    process.env.YOUTUBE_API_KEY = "yt";
    const config = getAppConfig();
    expect(config.analysisMode).toBe("gemini");
  });

  it("forces v1 when ANALYSIS_VERSION=v1", () => {
    process.env.ANALYSIS_MODE = "gemini";
    process.env.ANALYSIS_VERSION = "v1";
    process.env.GEMINI_API_KEY = "key";
    process.env.YOUTUBE_API_KEY = "yt";

    const config = getAppConfig();
    expect(config.analysisVersion).toBe("v1");
    expect(config.analysisV2MultimodalEnabled).toBe(false);
  });

  it("requires OAuth keys when performance is enabled", () => {
    process.env.ENABLE_PERFORMANCE = "true";
    expect(() => getAppConfig()).toThrow(ConfigError);

    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_REDIRECT_URL = "http://localhost/callback";
    process.env.TOKEN_ENCRYPTION_KEY = "a-secure-key-32-bytes-long-------";
    const config = getAppConfig();
    expect(config.performanceEnabled).toBe(true);
    expect(config.googleClientId).toBe("id");
  });

  it("enables multimodal flag when requested", () => {
    process.env.ANALYSIS_MODE = "gemini";
    process.env.GEMINI_API_KEY = "key";
    process.env.YOUTUBE_API_KEY = "yt";
    process.env.ENABLE_ANALYSIS_V2_MULTIMODAL = "true";
    const config = getAppConfig();
    expect(config.analysisV2MultimodalEnabled).toBe(true);
    expect(config.analysisVersion).toBe("v2");
  });

  it("respects ENABLE_ADVANCED_METRICS override", () => {
    process.env.ANALYSIS_MODE = "gemini";
    process.env.GEMINI_API_KEY = "key";
    process.env.YOUTUBE_API_KEY = "yt";
    process.env.ENABLE_ADVANCED_METRICS = "false";

    const config = getAppConfig();
    expect(config.advancedMetricsEnabled).toBe(false);
  });

  it("respects ENABLE_STRUCTURE_PASS override", () => {
    process.env.ENABLE_STRUCTURE_PASS = "false";
    const config = getAppConfig();
    expect(config.structurePassEnabled).toBe(false);
  });

  it("uses STRUCTURE_PASS_TIMEOUT_MS when provided", () => {
    process.env.STRUCTURE_PASS_TIMEOUT_MS = "45000";
    const config = getAppConfig();
    expect(config.structurePassTimeoutMs).toBe(45000);
  });
});
