import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();

vi.mock("../../../lib/db", () => ({
  default: {
    videoAnalysis: {
      findMany: (...args: any[]) => mockFindMany(...args),
    },
  },
}));

import { GET } from "./route";

describe("GET /api/history", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it("returns recent analyses for the current session", async () => {
    const analysis = {
      id: "analysis-1",
      youtubeVideoId: "vid-history-1",
      title: "History Video 1",
      channelTitle: "History Channel",
      thumbnailUrl: "http://thumb/1",
      durationSeconds: 90,
      status: "complete",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      creator: { displayName: "History User" },
      sessionId: "sess-history",
    };

    mockFindMany.mockResolvedValue([analysis]);

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
