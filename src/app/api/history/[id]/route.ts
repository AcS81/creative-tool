import { NextResponse } from "next/server";
import prisma from "../../../../lib/db";
import { buildSessionCookie, ensureSessionId } from "../../../../lib/session";
import { generateInsights } from "../../../../lib/analysis/insights";
import { generateDomainInsights } from "../../../../lib/analysis/domainInsights";
import { attachFingerprintLoadError, fetchReferenceData, safeParseFingerprint } from "../../analyze/utils";

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

  if (!analysis || !analysis.videoFingerprint) {
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
    console.warn("domainInsights generation failed for history load, returning empty", e);
  }

  const response = NextResponse.json({
    videoAnalysisId: analysis.id,
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
