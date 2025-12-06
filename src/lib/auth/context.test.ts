import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAuthContext, requirePerformanceReady } from "./context";
import prisma from "../db";

const originalEnv = { ...process.env };

describe("auth context", () => {
  beforeEach(async () => {
    process.env = { ...originalEnv };
    process.env.ENABLE_PERFORMANCE = "true";
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_REDIRECT_URL = "http://localhost/api/auth/youtube/callback";
    process.env.TOKEN_ENCRYPTION_KEY = "a-secure-key-32-bytes-long-------";
    await prisma.youtubeAuthToken.deleteMany();
    await prisma.user.deleteMany();
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await prisma.youtubeAuthToken.deleteMany();
    await prisma.user.deleteMany();
  });

  it("returns null when no user exists", async () => {
    const ctx = await getAuthContext();
    expect(ctx).toBeNull();
  });

  it("returns the first user when performance is enabled", async () => {
    const user = await prisma.user.create({
      data: {
        displayName: "Local User",
        googleAccountId: "google-id-1",
        email: "user@example.com",
      },
    });

    const ctx = await getAuthContext();
    expect(ctx).not.toBeNull();
    expect(ctx?.userId).toBe(user.id);
    expect(ctx?.googleAccountId).toBe("google-id-1");
    expect(ctx?.email).toBe("user@example.com");

    const config = {
      analysisMode: "gemini" as const,
      performanceEnabled: true,
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
      googleRedirectUrl: process.env.GOOGLE_REDIRECT_URL,
      geminiApiKey: "k",
      youtubeApiKey: "k",
      tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY,
    };
    expect(() => requirePerformanceReady(config)).not.toThrow();
  });
});

