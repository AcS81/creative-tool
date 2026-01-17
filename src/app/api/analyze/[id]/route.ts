import { NextResponse } from "next/server";
import prisma from "../../../../lib/db";
import { buildSessionCookie, ensureSessionId } from "../../../../lib/session";
import { attachFingerprintLoadError, fetchReferenceData, safeParseFingerprint } from "../utils";
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
      void enqueueAnalysisJob(analysis.id);
    }

    const response = NextResponse.json({
      videoAnalysisId: analysis.id,
      status: analysis.status,
      failureReason: analysis.failureReason ?? undefined,
      diagnostics,
      analysisStage: analysis.analysisStage ?? undefined,
      stageStartedAt: analysis.stageStartedAt?.toISOString(),
      leaseHeartbeatAt: analysis.leaseHeartbeatAt?.toISOString(),
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

  const fingerprintResult = safeParseFingerprint(analysis.videoFingerprint.fingerprint, {
    expectedSchemaHash: analysis.fingerprintSchemaHash,
    expectedSchemaVersion: analysis.fingerprintSchemaVersion,
  });
  if (!fingerprintResult.fingerprint) {
    const diagnosticsWithError = attachFingerprintLoadError(diagnostics, fingerprintResult.error);
    const status = fingerprintResult.error?.code === "invalid_json" ? 500 : 409;
    return NextResponse.json(
      {
        error: "FingerprintIncompatible",
        message: fingerprintResult.error?.message ?? "Stored fingerprint is invalid.",
        diagnostics: diagnosticsWithError,
      },
      { status },
    );
  }
  const fingerprint = fingerprintResult.fingerprint;

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

export async function POST(
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
  });

  if (!analysis) {
    return NextResponse.json(
      { error: "NotFound", message: "Analysis not found for this session." },
      { status: 404 },
    );
  }

  if (!["pending", "running"].includes(analysis.status)) {
    return NextResponse.json(
      { error: "InvalidState", message: "Only pending or running analyses can be resumed." },
      { status: 409 },
    );
  }

  const now = new Date();
  const updated = await prisma.videoAnalysis.updateMany({
    where: { id: analysis.id, sessionId },
    data: {
      status: "pending",
      failureReason: null,
      nextAttemptAt: now,
      leaseOwner: null,
      leaseExpiresAt: null,
      leaseHeartbeatAt: null,
    },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      { error: "ResumeFailed", message: "Could not resume this analysis. Please try again." },
      { status: 409 },
    );
  }

  const response = NextResponse.json({
    videoAnalysisId: analysis.id,
    status: "pending",
    analysisStage: analysis.analysisStage ?? undefined,
    stageStartedAt: analysis.stageStartedAt?.toISOString(),
  });

  if (isNew) {
    response.headers.append("Set-Cookie", buildSessionCookie(sessionId));
  }

  return response;
}
