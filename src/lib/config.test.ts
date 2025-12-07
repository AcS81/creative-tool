import { beforeEach, describe, expect, it } from "vitest";
import { ConfigError, getAppConfig } from "./config";

const originalEnv = { ...process.env };

describe("getAppConfig", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ANALYSIS_MODE;
    delete process.env.ENABLE_PERFORMANCE;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URL;
    delete process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.YOUTUBE_API_KEY;
    delete process.env.ENABLE_ANALYSIS_V2_MULTIMODAL;
  });

  it("defaults to mock mode and performance disabled", () => {
    const config = getAppConfig();
    expect(config.analysisMode).toBe("mock");
    expect(config.performanceEnabled).toBe(false);
    expect(config.analysisV2MultimodalEnabled).toBe(false);
  });

  it("requires Gemini keys when ANALYSIS_MODE=gemini", () => {
    process.env.ANALYSIS_MODE = "gemini";
    expect(() => getAppConfig()).toThrow(ConfigError);

    process.env.GEMINI_API_KEY = "key";
    process.env.YOUTUBE_API_KEY = "yt";
    const config = getAppConfig();
    expect(config.analysisMode).toBe("gemini");
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
    process.env.ENABLE_ANALYSIS_V2_MULTIMODAL = "true";
    const config = getAppConfig();
    expect(config.analysisV2MultimodalEnabled).toBe(true);
  });
});
