"use client";

import { useState } from "react";
import { isValidYouTubeUrl } from "../lib/youtube";
import type { VideoFingerprintJson } from "../lib/types";
import { RadarChartOverview } from "../components/RadarChartOverview";
import { AnalysisLayout } from "../components/Layout/AnalysisLayout";
import { DomainCard } from "../components/DomainCard";
import { DomainTimeline } from "../components/DomainTimeline";

type NearestReference = { creatorId: string; displayName: string; distance: number };
type AnalyzeResponse = {
  videoAnalysisId: string;
  fingerprint: VideoFingerprintJson;
  overallArchetype: string;
  nearestReferences: NearestReference[];
  nicheAverageMetaAxes?: VideoFingerprintJson["metaAxes"] | null;
  insights?: string[];
  metadata?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    durationSeconds?: number;
  };
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "voice" | "language" | "narrative" | "visual" | "editing" | "sound"
  >("overview");

  const domainProfiles = result?.fingerprint.perDomain;
  const supporting = result?.fingerprint.supporting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!isValidYouTubeUrl(url)) {
      setError("Please enter a valid YouTube URL.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message ?? "Could not analyze this URL. Please try again.");
        return;
      }

      const body = (await res.json()) as AnalyzeResponse;
      setResult(body);
    } catch {
      setError("Could not analyze this URL. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-14 lg:py-16">
      <div className="cs-card w-full p-10 backdrop-blur">
        <p className="cs-kicker">CreatorSight</p>
        <h1 className="cs-heading mt-3 leading-tight">
          Paste a YouTube URL to get a creative fingerprint.
        </h1>
        <p className="cs-body mt-3 max-w-3xl text-muted">
          We validate the link, run the configured analysis pipeline, and preview your archetype,
          radar, and closest reference creators.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-4 md:grid-cols-[2fr,1fr]">
          <div className="cs-panel p-6 shadow-sm">
            <label className="cs-label" htmlFor="url">
              YouTube URL
            </label>
            <input
              id="url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              className="cs-input mt-2"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            <button type="submit" className="cs-button mt-4" disabled={loading}>
              {loading ? "Analyzing..." : "Analyze video"}
            </button>
          </div>
          <div className="cs-panel p-6 shadow-sm">
            <p className="text-sm font-semibold text-muted">What to expect</p>
            <ul className="mt-3 space-y-2 text-sm text-foreground/80">
              <li>✅ Validate YouTube URL client-side</li>
              <li>✅ Call mock or Gemini pipeline</li>
              <li>✅ Show archetype + nearest neighbours</li>
              <li>✅ Radar, unusual insights, domain tabs</li>
            </ul>
          </div>
        </form>
      </div>

      {result && (
        <div className="cs-card w-full space-y-6 p-8">
          <AnalysisLayout activeTab={activeTab} onTabChange={setActiveTab}>
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="cs-kicker text-[10px]">Overall archetype</p>
                    <p className="text-2xl font-semibold text-foreground">
                      {result.overallArchetype}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Analysis ID: {result.videoAnalysisId}
                    </p>
                  </div>
                  {result.metadata ? (
                    <div className="cs-panel border-border/80 bg-surface px-4 py-3 text-sm text-muted shadow-sm">
                      <p className="font-semibold text-foreground">{result.metadata.title}</p>
                      <p>{result.metadata.channelTitle}</p>
                      <p>
                        {result.metadata.publishedAt
                          ? new Date(result.metadata.publishedAt).toLocaleDateString()
                          : "Publish date unknown"}
                        {" • "}
                        {typeof result.metadata.durationSeconds === "number"
                          ? formatDuration(result.metadata.durationSeconds)
                          : "Duration unknown"}
                      </p>
                    </div>
                  ) : null}
                </div>

                <RadarChartOverview
                  fingerprint={result.fingerprint}
                  comparisonValues={result.nicheAverageMetaAxes || undefined}
                  comparisonLabel="Reference avg"
                />

                <div className="mt-4">
                  <p className="text-sm font-semibold text-muted">Nearest reference creators</p>
                  <div className="mt-2 grid gap-3 md:grid-cols-3">
                    {result.nearestReferences.map((ref) => (
                      <div
                        key={ref.creatorId}
                        className="rounded-md border border-border bg-surface p-3 shadow-sm"
                      >
                        <p className="text-base font-semibold">{ref.displayName}</p>
                        <p className="text-xs text-muted">Distance: {ref.distance.toFixed(2)}</p>
                      </div>
                    ))}
                    {result.nearestReferences.length === 0 && (
                      <p className="text-sm text-muted">No reference data available yet.</p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-muted">Where you’re unusual</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-foreground/80">
                    {(result.insights ?? []).map((insight, idx) => (
                      <li key={idx}>{insight}</li>
                    ))}
                    {(!result.insights || result.insights.length === 0) && (
                      <li className="text-muted">Not enough reference data yet.</li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {activeTab !== "overview" && (
              <div className="space-y-3">
                {activeTab === "voice" && domainProfiles?.voiceProfile && (
                  <DomainCard name="Your Voice" profile={domainProfiles.voiceProfile} />
                )}
                {activeTab === "language" && domainProfiles?.languageProfile && (
                  <DomainCard name="Your Language" profile={domainProfiles.languageProfile} />
                )}
                {activeTab === "narrative" && domainProfiles?.narrativeProfile && (
                  <div className="space-y-4">
                    <DomainCard name="Your Narrative" profile={domainProfiles.narrativeProfile} />
                    <DomainTimeline
                      beats={supporting?.beats}
                      transcriptSegments={supporting?.transcriptSegments}
                    />
                  </div>
                )}
                {activeTab === "visual" && domainProfiles?.visualProfile && (
                  <DomainCard name="Your Visuals" profile={domainProfiles.visualProfile} />
                )}
                {activeTab === "editing" && domainProfiles?.editingProfile && (
                  <div className="space-y-4">
                    <DomainCard name="Your Editing" profile={domainProfiles.editingProfile} />
                    <DomainTimeline beats={supporting?.sceneSegments} />
                  </div>
                )}
                {activeTab === "sound" && domainProfiles?.soundProfile && (
                  <DomainCard name="Your Sound" profile={domainProfiles.soundProfile} />
                )}
                {!domainProfiles && (
                  <p className="text-sm text-muted">Run an analysis first.</p>
                )}
              </div>
            )}
          </AnalysisLayout>
        </div>
      )}
    </main>
  );
}

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) return "Unknown";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}
