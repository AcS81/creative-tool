"use client";

import { useState } from "react";
import { isValidYouTubeUrl } from "../lib/youtube";
import type { VideoFingerprintJson } from "../lib/types";
import { RadarChartOverview } from "../components/RadarChartOverview";
import { AnalysisLayout } from "../components/Layout/AnalysisLayout";
import { DomainCard } from "../components/DomainCard";

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
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-16">
      <div className="w-full rounded-lg border border-border bg-surface/80 p-10 shadow-[var(--shadow-soft)] backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          CreatorSight
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight">
          Paste a YouTube URL to get a creative fingerprint.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          We validate the link, run a mock analysis pipeline, and preview your archetype and nearest
          reference creators.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-4 md:grid-cols-[2fr,1fr]">
          <div className="rounded-md border border-border bg-white/70 p-6 shadow-sm">
            <label className="block text-sm font-medium text-muted" htmlFor="url">
              YouTube URL
            </label>
            <input
              id="url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              className="mt-2 w-full rounded-md border border-border bg-white/60 px-4 py-3 text-base text-foreground shadow-inner outline-none focus:border-accent focus:ring-2 focus:ring-accent/40"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              className="mt-4 inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Analyzing..." : "Analyze video"}
            </button>
          </div>
          <div className="rounded-md border border-border bg-white/70 p-6 shadow-sm">
            <p className="text-sm font-semibold text-muted">What to expect</p>
            <ul className="mt-3 space-y-2 text-sm text-foreground/80">
              <li>✅ Validate YouTube URL client-side</li>
              <li>✅ Call mock analysis API</li>
              <li>✅ Show archetype + nearest neighbours</li>
              <li>🚧 Radar & domain tabs coming next</li>
            </ul>
          </div>
        </form>
      </div>

      {result && (
        <div className="w-full space-y-6 rounded-lg border border-border bg-white/80 p-8 shadow-[var(--shadow-soft)]">
          <AnalysisLayout activeTab={activeTab} onTabChange={setActiveTab}>
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">
                      Overall archetype
                    </p>
                    <p className="text-2xl font-semibold">{result.overallArchetype}</p>
                    <p className="mt-1 text-sm text-muted">Analysis ID: {result.videoAnalysisId}</p>
                  </div>
                  {result.metadata ? (
                    <div className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted">
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
                  <DomainCard name="Your Narrative" profile={domainProfiles.narrativeProfile} />
                )}
                {activeTab === "visual" && domainProfiles?.visualProfile && (
                  <DomainCard name="Your Visuals" profile={domainProfiles.visualProfile} />
                )}
                {activeTab === "editing" && domainProfiles?.editingProfile && (
                  <DomainCard name="Your Editing" profile={domainProfiles.editingProfile} />
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
