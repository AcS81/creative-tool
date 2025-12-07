import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import prisma from "../db";
import {
  buildSessionCookie,
  ensureSessionId,
  getAnalysesForSession,
  getSessionCookieName,
  parseSessionIdFromCookieHeader,
} from "./index";

describe("session helpers", () => {
  const originalFindMany = prisma.videoAnalysis.findMany.bind(prisma.videoAnalysis);

  beforeEach(async () => {
    await prisma.videoFingerprint.deleteMany();
    await prisma.videoAnalysis.deleteMany();
    await prisma.creatorProfile.deleteMany();
  });

  afterEach(async () => {
    (prisma.videoAnalysis as any).findMany = originalFindMany;
    await prisma.videoFingerprint.deleteMany();
    await prisma.videoAnalysis.deleteMany();
    await prisma.creatorProfile.deleteMany();
  });

  it("generates a new sessionId when none is present", () => {
    const { sessionId, isNew } = ensureSessionId(undefined);
    expect(isNew).toBe(true);
    expect(sessionId).toBeTruthy();
  });

  it("parses existing sessionId from cookie header", () => {
    const name = getSessionCookieName();
    const header = `${name}=abc123; Path=/; HttpOnly`;
    const parsed = parseSessionIdFromCookieHeader(header);
    expect(parsed).toBe("abc123");

    const ensured = ensureSessionId(header);
    expect(ensured.isNew).toBe(false);
    expect(ensured.sessionId).toBe("abc123");
  });

  it("builds a set-cookie header string", () => {
    const cookie = buildSessionCookie("session-xyz", { maxAgeSeconds: 3600 });
    expect(cookie).toContain(`${getSessionCookieName()}=session-xyz`);
    expect(cookie).toContain("Max-Age=3600");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
  });

  it("fetches analyses scoped to a sessionId", async () => {
    const creator = await prisma.creatorProfile.create({
      data: {
        displayName: "Test Creator",
        type: "user",
      },
    });

    const a1 = await prisma.videoAnalysis.create({
      data: {
        creatorId: creator.id,
        youtubeVideoId: "vid1",
        title: "Video 1",
        durationSeconds: 60,
        status: "complete",
        sessionId: "sess-1",
      },
    });

    const a2 = await prisma.videoAnalysis.create({
      data: {
        creatorId: creator.id,
        youtubeVideoId: "vid2",
        title: "Video 2",
        durationSeconds: 120,
        status: "pending",
        sessionId: "sess-1",
      },
    });

    await prisma.videoAnalysis.create({
      data: {
        creatorId: creator.id,
        youtubeVideoId: "vid3",
        title: "Video 3",
        durationSeconds: 90,
        status: "complete",
        sessionId: "sess-other",
      },
    });

    (prisma.videoAnalysis as any).findMany = vi.fn().mockResolvedValue([
      { ...a1, creator },
      { ...a2, creator },
    ]);

    const analyses = await getAnalysesForSession("sess-1");
    const ids = analyses.map((a) => a.id);

    expect(ids).toContain(a1.id);
    expect(ids).toContain(a2.id);
    expect(ids.length).toBe(2);
  });
});
