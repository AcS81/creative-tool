import { NextResponse } from "next/server";
import { getAppConfig } from "../../../../lib/config";
import { analyzeVideoMultimodal } from "../../../../lib/analysis/geminiMultimodalAnalyzer";
import { buildVideoFingerprint } from "../../../../lib/analysis/fingerprint/videoFingerprint";
import { computeMetaAxesFromProfiles } from "../../../../lib/analysis/fingerprint/videoFingerprint";
import type { FingerprintPerDomain } from "../../../../lib/types/fingerprint";

export const dynamic = "force-dynamic";

const toFingerprintDomains = (
  profiles: Awaited<ReturnType<typeof analyzeVideoMultimodal>>["profiles"],
): FingerprintPerDomain => ({
  voiceProfile: profiles.voice,
  languageProfile: profiles.language,
  narrativeProfile: profiles.narrative,
  visualProfile: profiles.visual,
  editingProfile: profiles.editing,
  soundProfile: profiles.sound,
});

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

    const perDomain = toFingerprintDomains(analysis.profiles);
    const fingerprint = buildVideoFingerprint(perDomain, {
      metaAxes: computeMetaAxesFromProfiles(perDomain),
      supporting: { beats: analysis.beats, axisDetails: analysis.axisDetails },
      version: "1.3.0",
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
