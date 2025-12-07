import { NextResponse } from "next/server";
import { getAppConfig } from "../../../../lib/config";
import { analyzeVideoMultimodal } from "../../../../lib/analysis/geminiMultimodalAnalyzer";
import { buildVideoFingerprint } from "../../../../lib/analysis/fingerprint/videoFingerprint";
import { computeMetaAxesFromProfiles } from "../../../../lib/analysis/fingerprint/videoFingerprint";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as { url?: string; enableFlag?: boolean };
  const youtubeUrl = body.url;
  const config = getAppConfig();

  if (!youtubeUrl) {
    return NextResponse.json({ ok: false, error: "Missing url" }, { status: 400 });
  }

  try {
    const analysis = await analyzeVideoMultimodal({
      youtubeUrl,
      config: {
        ...config,
        analysisV2MultimodalEnabled: body.enableFlag ?? true,
      },
    });

    const fingerprint = buildVideoFingerprint(analysis.profiles, {
      metaAxes: computeMetaAxesFromProfiles(analysis.profiles),
      supporting: { beats: analysis.beats, axisDetails: analysis.axisDetails },
      version: "1.2.0",
    });

    return NextResponse.json({
      ok: true,
      fromFallback: analysis.diagnostics.fromFallback,
      unobservedCounts: analysis.diagnostics.unobservedCounts,
      fingerprint,
      diagnostics: {
        source: "gemini-v2-multimodal",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
