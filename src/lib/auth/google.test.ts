import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { buildOAuthUrl, exchangeCodeForTokens, persistYoutubeTokens } from "./google";
import prisma from "../db";

const originalEnv = { ...process.env };

describe("google oauth helpers", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_REDIRECT_URL = "http://localhost/api/auth/youtube/callback";
    process.env.TOKEN_ENCRYPTION_KEY = "a-secure-key-32-bytes-long-------";
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await prisma.youtubeAuthToken.deleteMany();
    await prisma.user.deleteMany();
  });

  it("builds an auth url with required params", () => {
    const url = buildOAuthUrl("state123");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("client_id")).toBe("client");
    expect(parsed.searchParams.get("redirect_uri")).toBe("http://localhost/api/auth/youtube/callback");
    expect(parsed.searchParams.get("scope")).toContain("youtube.readonly");
    expect(parsed.searchParams.get("state")).toBe("state123");
  });

  it("exchanges code for tokens and persists them", async () => {
    const mockTokens = {
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 3600,
      scope: "scope",
      token_type: "Bearer",
    };
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockTokens,
    } as any);

    const tokens = await exchangeCodeForTokens("code123");
    expect(tokens.access_token).toBe("access");
    await persistYoutubeTokens(tokens);

    const stored = await prisma.youtubeAuthToken.findFirst();
    expect(stored?.accessTokenEncrypted).toBeTruthy();
    expect(stored?.refreshTokenEncrypted).toBeTruthy();
  });
});
