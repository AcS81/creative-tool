import { afterEach, beforeEach, describe, expect, it } from "vitest";
import prisma from "../../../../../lib/db";
import { GET } from "./route";

const originalEnv = { ...process.env };

describe("GET /api/auth/youtube/status", () => {
  beforeEach(async () => {
    process.env = { ...originalEnv };
    await prisma.youtubeAuthToken.deleteMany();
    await prisma.user.deleteMany();
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await prisma.youtubeAuthToken.deleteMany();
    await prisma.user.deleteMany();
  });

  it("returns disabled when performance mode is off", async () => {
    process.env.ENABLE_PERFORMANCE = "false";

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.performanceEnabled).toBe(false);
    expect(body.connected).toBe(false);
  });

  it("reports connected when tokens exist", async () => {
    process.env.ANALYSIS_MODE = "mock";
    process.env.ENABLE_PERFORMANCE = "true";
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_REDIRECT_URL = "http://localhost/api/auth/youtube/callback";
    process.env.TOKEN_ENCRYPTION_KEY = "a-secure-key-32-bytes-long-------";

    const user = await prisma.user.create({ data: { displayName: "Status Tester" } });
    await prisma.youtubeAuthToken.create({
      data: {
        userId: user.id,
        accessTokenEncrypted: "access",
        refreshTokenEncrypted: "refresh",
      },
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.performanceEnabled).toBe(true);
    expect(body.connected).toBe(true);
    expect(body.tokens).toBeGreaterThan(0);
  });
});
