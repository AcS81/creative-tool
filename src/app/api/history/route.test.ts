import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";
import prisma from "../../../lib/db";

describe("GET /api/history", () => {
  beforeEach(async () => {
    await prisma.videoFingerprint.deleteMany();
    await prisma.videoAnalysis.deleteMany();
    await prisma.creatorProfile.deleteMany();
  });

  it("returns recent analyses for the current session", async () => {
    const creator = await prisma.creatorProfile.create({
      data: {
        displayName: "History User",
        type: "user",
      },
    });

    const analysis = await prisma.videoAnalysis.create({
      data: {
        creatorId: creator.id,
        youtubeVideoId: "vid-history-1",
        title: "History Video 1",
        channelTitle: "History Channel",
        thumbnailUrl: "http://thumb/1",
        durationSeconds: 90,
        status: "complete",
        sessionId: "sess-history",
      },
    });

    const res = await GET(
      new Request("http://localhost/api/history", {
        headers: {
          cookie: "cs_session_id=sess-history",
        },
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.items[0].id).toBe(analysis.id);
    expect(json.items[0].title).toBe("History Video 1");
    expect(json.items[0].channelTitle).toBe("History Channel");
  });
});

