import { NextResponse } from "next/server";
import prisma from "../../../../lib/db";
import { buildSessionCookie, ensureSessionId } from "../../../../lib/session";
import { fetchReferenceData, safeParseFingerprint } from "../utils";
import { generateInsights } from "../../../../lib/analysis/insights";
import { generateDomainInsights } from "../../../../lib/analysis/domainInsights";
import { enqueueAnalysisJob } from "../../../../lib/analysis/jobs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const cookieHeader = request.headers.get("cookie");
  const { sessionId, isNew } = ensureSessionId(cookieHeader);

  if (!params.id) {
    return NextResponse.json(
      { error: "InvalidRequest", message: "Analysis id is required." },
      { status: 400 },
    );
  }

  const analysis = await prisma.videoAnalysis.findFirst({
    where: { id: params.id, sessionId },
    include: {
      creator: true,
      videoFingerprint: true,
    },
  });

  if (!analysis) {
    return NextResponse.json(
      { error: "NotFound", message: "Analysis not found for this session." },
      { status: 404 },
    );
  }

  let diagnostics: unknown;
  if (analysis.diagnosticsJson) {
    try {
      diagnostics = JSON.parse(analysis.diagnosticsJson);
    } catch {
      diagnostics = undefined;
    }
  }

  if (analysis.status !== "complete") {
    const now = new Date();
    if (analysis.status === "pending" && (!analysis.nextAttemptAt || analysis.nextAttemptAt <= now)) {
      enqueueAnalysisJob(analysis.id);
    }

    const response = NextResponse.json({
      videoAnalysisId: analysis.id,
      status: analysis.status,
      failureReason: analysis.failureReason ?? undefined,
      diagnostics,
    });

    if (isNew) {
      response.headers.append("Set-Cookie", buildSessionCookie(sessionId));
    }

    return response;
  }

  if (!analysis.videoFingerprint) {
    return NextResponse.json(
      { error: "InvalidData", message: "Stored fingerprint is missing." },
      { status: 500 },
    );
  }

  const fingerprint = safeParseFingerprint(analysis.videoFingerprint.fingerprint);
  if (!fingerprint) {
    return NextResponse.json(
      { error: "InvalidData", message: "Stored fingerprint is invalid." },
      { status: 500 },
    );
  }

  const { nearestReferences, averageMetaAxes, referenceMetaAxes } = await fetchReferenceData(fingerprint);
  const insightDetails = generateInsights(fingerprint.metaAxes, referenceMetaAxes);

  let domainInsights: ReturnType<typeof generateDomainInsights> = {
    voiceProfile: [],
    languageProfile: [],
    narrativeProfile: [],
    visualProfile: [],
    editingProfile: [],
    soundProfile: [],
  };
  try {
    domainInsights = generateDomainInsights(fingerprint, referenceMetaAxes);
  } catch (e) {
    console.warn("domainInsights generation failed for analysis load, returning empty", e);
  }

  const response = NextResponse.json({
    videoAnalysisId: analysis.id,
    status: analysis.status,
    fingerprint,
    overallArchetype: fingerprint.overallArchetype,
    nearestReferences,
    nicheAverageMetaAxes: averageMetaAxes,
    insights: insightDetails.bullets,
    insightDetails,
    domainInsights,
    diagnostics,
    metadata: {
      title: analysis.title,
      channelTitle: analysis.channelTitle ?? analysis.creator.displayName,
      publishedAt: undefined,
      durationSeconds: analysis.durationSeconds,
      thumbnailUrl: analysis.thumbnailUrl ?? undefined,
    },
  });

  if (isNew) {
    response.headers.append("Set-Cookie", buildSessionCookie(sessionId));
  }

  return response;
}
