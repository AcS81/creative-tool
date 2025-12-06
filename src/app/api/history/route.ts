import { NextResponse } from "next/server";
import prisma from "../../../lib/db";
import { buildSessionCookie, ensureSessionId } from "../../../lib/session";

const HISTORY_LIMIT = 10;

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const { sessionId, isNew } = ensureSessionId(cookieHeader);

  const analyses = await prisma.videoAnalysis.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    include: {
      creator: true,
    },
  });

  const items = analyses.map((analysis) => ({
    id: analysis.id,
    youtubeVideoId: analysis.youtubeVideoId,
    title: analysis.title,
    channelTitle: analysis.channelTitle ?? analysis.creator.displayName,
    thumbnailUrl: analysis.thumbnailUrl ?? undefined,
    createdAt: analysis.createdAt.toISOString(),
    status: analysis.status,
    durationSeconds: analysis.durationSeconds,
  }));

  const response = NextResponse.json({ items });
  if (isNew) {
    response.headers.append("Set-Cookie", buildSessionCookie(sessionId));
  }
  return response;
}

