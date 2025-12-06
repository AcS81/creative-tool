"use client";

import { useEffect, useState } from "react";
import { isValidYouTubeUrl } from "../lib/youtube";
import type { VideoFingerprintJson } from "../lib/types";
import { RadarChartOverview } from "../components/RadarChartOverview";
import { AnalysisLayout } from "../components/Layout/AnalysisLayout";
import { DomainCard } from "../components/DomainCard";
import { DomainTimeline } from "../components/DomainTimeline";
import { AppShell } from "../components/AppShell";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Chip } from "../components/Chip";
import { DomainView } from "../components/DomainView";
import { DomainRadar } from "../components/DomainRadar";
import { sampleAnalysisResult, sampleMetadata } from "../lib/sampleAnalysis";
import { PerformanceView } from "../components/PerformanceView";
import { performanceCoaching } from "../lib/analysis/performanceCoaching";

type NearestReference = { creatorId: string; displayName: string; distance: number };
type AnalyzeResponse = {
  videoAnalysisId: string;
  fingerprint: VideoFingerprintJson;
  overallArchetype: string;
  nearestReferences: NearestReference[];
  nicheAverageMetaAxes?: VideoFingerprintJson["metaAxes"] | null;
  insights?: string[];
  insightDetails?: {
    unusualnessInsights: string[];
    strengthInsights: string[];
    growthInsights: string[];
    bullets: string[];
  };
  domainInsights?: {
    voiceProfile?: string[];
    languageProfile?: string[];
    narrativeProfile?: string[];
    visualProfile?: string[];
    editingProfile?: string[];
    soundProfile?: string[];
  };
  metadata?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    durationSeconds?: number;
    thumbnailUrl?: string;
  };
};

const tabKeys = [
  "overview",
  "voice",
  "language",
  "narrative",
  "visual",
  "editing",
  "sound",
  "performance",
] as const;

export default function Home() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "voice" | "language" | "narrative" | "visual" | "editing" | "sound" | "performance"
  >("overview");
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const domainProfiles = result?.fingerprint.perDomain;
  const supporting = result?.fingerprint.supporting;

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const validTabs = new Set(tabKeys);
    if (tabParam && validTabs.has(tabParam as (typeof tabKeys)[number]) && tabParam !== activeTab) {
      setActiveTab(tabParam as typeof activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", tab);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const loadSample = () => {
    setError(null);
    setLoading(false);
    setResult({
      videoAnalysisId: "sample-analysis",
      fingerprint: {
        ...sampleAnalysisResult.fingerprint,
        hasPerformanceData: false,
      } as VideoFingerprintJson,
      overallArchetype: sampleAnalysisResult.overallArchetype,
      nearestReferences: [],
      nicheAverageMetaAxes: null,
      insights: ["Sample insights: this is a demo view."],
      insightDetails: {
        unusualnessInsights: [],
        strengthInsights: [],
        growthInsights: [],
        bullets: ["Sample insights: this is a demo view."],
      },
      domainInsights: {
        voiceProfile: ["Sample: energetic delivery."],
        languageProfile: ["Sample: balanced explanation and takes."],
        narrativeProfile: ["Sample: clear setups and payoffs."],
        visualProfile: ["Sample: steady framing with motion accents."],
        editingProfile: ["Sample: cut-heavy pacing with polish."],
        soundProfile: ["Sample: balanced mix under voice."],
      },
      metadata: sampleMetadata,
    });
  };

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
    <AppShell>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 py-4 lg:py-6">
      <div className="cs-card w-full p-10 backdrop-blur">
        <div className="flex flex-col gap-3">
          <p className="cs-kicker">CreatorSight</p>
          <h1 className="cs-heading leading-tight text-foreground">
            Paste a YouTube URL to get a creative fingerprint.
          </h1>
          <p className="cs-body max-w-3xl text-muted">
            We validate the link, run the configured analysis pipeline, and preview your archetype,
            radar, and closest reference creators.
          </p>
        </div>

        <form
          id="analysis"
          onSubmit={handleSubmit}
          className="mt-8 grid gap-4 md:grid-cols-[2fr,1fr]"
        >
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
              <li>🔒 Connect YouTube to enable performance data (Iteration 4)</li>
            </ul>
            <button
              type="button"
              className="cs-button mt-4 w-full justify-center"
              onClick={loadSample}
            >
              Try a sample analysis
            </button>
            <a
              className="cs-link mt-3 inline-flex items-center text-sm font-semibold text-accent hover:underline"
              href="/api/auth/youtube/start"
            >
              Connect YouTube (OAuth)
            </a>
          </div>
        </form>
      </div>

      {loading && (
        <div className="cs-card space-y-4 p-6">
          <p className="text-sm font-semibold text-muted">Analyzing your video…</p>
          <div className="grid gap-3">
            <div className="h-4 w-1/2 animate-pulse rounded bg-surface-strong" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-surface-strong" />
            <div className="h-40 animate-pulse rounded bg-surface-strong" />
          </div>
          <p className="text-xs text-muted">
            This may take up to a few minutes in Gemini mode; the page will populate on completion.
          </p>
        </div>
      )}

      {!loading && error && !result && (
        <div className="cs-card space-y-2 p-6 border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-700">Analysis failed</p>
          <p className="text-sm text-red-600">{error}</p>
          <p className="text-xs text-red-500">Double-check the URL and try again.</p>
        </div>
      )}

      {!loading && !error && !result && (
        <div className="cs-card space-y-3 p-6">
          <p className="text-sm font-semibold text-foreground">No analysis yet</p>
          <p className="text-sm text-muted">
            Paste a YouTube URL above to see your fingerprint, or load our sample analysis.
          </p>
          <button
            type="button"
            className="cs-button w-fit"
            onClick={loadSample}
          >
            Load sample analysis
          </button>
        </div>
      )}

      {result && (
        <div className="cs-card w-full space-y-6 p-8">
          <AnalysisLayout activeTab={activeTab} onTabChange={handleTabChange}>
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-[1.4fr,1fr]">
                  <div className="cs-panel flex flex-col gap-3 p-4 shadow-sm md:flex-row md:items-center md:gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 text-lg font-bold text-accent">
                        {result.overallArchetype.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="cs-kicker text-[10px]">Overall archetype</p>
                        <p className="text-xl font-semibold text-foreground">
                          {result.overallArchetype}
                        </p>
                        <p className="text-xs text-muted">Analysis ID: {result.videoAnalysisId}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Chip label={`Voice: ${result.fingerprint.perDomain.voiceProfile.primaryArchetype}`} />
                      <Chip
                        label={`Language: ${result.fingerprint.perDomain.languageProfile.primaryArchetype}`}
                      />
                      <Chip
                        label={`Narrative: ${result.fingerprint.perDomain.narrativeProfile.primaryArchetype}`}
                      />
                      <Chip
                        label={`Visual: ${result.fingerprint.perDomain.visualProfile.primaryArchetype}`}
                      />
                      <Chip
                        label={`Editing: ${result.fingerprint.perDomain.editingProfile.primaryArchetype}`}
                      />
                      <Chip
                        label={`Sound: ${result.fingerprint.perDomain.soundProfile.primaryArchetype}`}
                      />
                    </div>
                  </div>
                  {result.metadata ? (
                    <div className="cs-panel flex gap-3 p-4 shadow-sm">
                      {result.metadata.thumbnailUrl ? (
                        <div className="overflow-hidden rounded-lg border border-border/80 bg-surface-strong">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={result.metadata.thumbnailUrl}
                            alt={result.metadata.title ?? "Video thumbnail"}
                            className="h-20 w-32 object-cover"
                          />
                        </div>
                      ) : null}
                      <div className="space-y-1 text-sm text-muted">
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
                    </div>
                  ) : null}
              </div>

              <RadarChartOverview
                fingerprint={result.fingerprint}
                comparisonValues={result.nicheAverageMetaAxes || undefined}
                comparisonLabel="Reference avg"
              />

              <div className="grid gap-4 md:grid-cols-[2fr,1.2fr]">
                <div className="space-y-3 rounded-md border border-border bg-surface p-4 shadow-sm">
                  <p className="text-sm font-semibold text-muted">Insights</p>
                  <ul className="list-disc space-y-1 pl-4 text-sm text-foreground/85">
                    {(result.insightDetails?.bullets ?? result.insights ?? []).map((insight, idx) => (
                      <li key={idx}>{insight}</li>
                    ))}
                    {(!result.insights || result.insights.length === 0) && (
                      <li className="text-muted">Not enough reference data yet.</li>
                    )}
                  </ul>
                </div>
                <div className="space-y-3 rounded-md border border-border bg-surface p-4 shadow-sm">
                  <p className="text-sm font-semibold text-muted">Nearest reference creators</p>
                  <div className="grid gap-3">
                    {result.nearestReferences.map((ref) => (
                      <div
                        key={ref.creatorId}
                        className="rounded-md border border-border bg-surface-strong p-3 shadow-sm"
                      >
                        <p className="text-base font-semibold">{ref.displayName}</p>
                        <p className="text-xs text-muted">Distance: {ref.distance.toFixed(2)}</p>
                        {ref.closestAxis ? (
                          <p className="mt-1 text-xs text-muted">
                            Closest on {ref.closestAxis.label} ({Math.round(ref.closestAxis.delta)} pts)
                          </p>
                        ) : null}
                      </div>
                    ))}
                    {result.nearestReferences.length === 0 && (
                      <p className="text-sm text-muted">No reference data available yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

            {activeTab !== "overview" && (
              <div className="space-y-3">
                {activeTab === "voice" && domainProfiles?.voiceProfile && (
                  <DomainView
                    name="Your Voice"
                    domain="voice"
                    profile={domainProfiles.voiceProfile}
                    visual={<DomainRadar profile={domainProfiles.voiceProfile} />}
                    insights={result.domainInsights?.voiceProfile}
                  />
                )}
                {activeTab === "language" && domainProfiles?.languageProfile && (
                  <DomainView
                    name="Your Language"
                    domain="language"
                    profile={domainProfiles.languageProfile}
                    visual={<DomainRadar profile={domainProfiles.languageProfile} />}
                    insights={result.domainInsights?.languageProfile}
                  />
                )}
                {activeTab === "narrative" && domainProfiles?.narrativeProfile && (
                  <DomainView
                    name="Your Narrative"
                    domain="narrative"
                    profile={domainProfiles.narrativeProfile}
                    visual={<DomainRadar profile={domainProfiles.narrativeProfile} />}
                    insights={result.domainInsights?.narrativeProfile}
                    extra={
                      <DomainTimeline
                        beats={supporting?.beats}
                        transcriptSegments={supporting?.transcriptSegments}
                      />
                    }
                  />
                )}
                {activeTab === "visual" && domainProfiles?.visualProfile && (
                  <DomainView
                    name="Your Visuals"
                    domain="visual"
                    profile={domainProfiles.visualProfile}
                    visual={<DomainRadar profile={domainProfiles.visualProfile} />}
                    insights={result.domainInsights?.visualProfile}
                  />
                )}
                {activeTab === "editing" && domainProfiles?.editingProfile && (
                  <DomainView
                    name="Your Editing"
                    domain="editing"
                    profile={domainProfiles.editingProfile}
                    visual={<DomainRadar profile={domainProfiles.editingProfile} />}
                    insights={result.domainInsights?.editingProfile}
                    extra={<DomainTimeline beats={supporting?.sceneSegments} />}
                  />
                )}
                {activeTab === "sound" && domainProfiles?.soundProfile && (
                  <DomainView
                    name="Your Sound"
                    domain="sound"
                    profile={domainProfiles.soundProfile}
                    visual={<DomainRadar profile={domainProfiles.soundProfile} />}
                    insights={result.domainInsights?.soundProfile}
                  />
                )}
                {activeTab === "performance" && (
                  <PerformanceView
                    performanceProfile={result.fingerprint.performanceProfile}
                    hasPerformanceData={result.fingerprint.hasPerformanceData}
                    insights={
                      result.fingerprint.performanceProfile
                        ? performanceCoaching(result.fingerprint.performanceProfile, result.fingerprint.metaAxes)
                        : []
                    }
                  />
                )}
                {!domainProfiles && (
                  <p className="text-sm text-muted">Run an analysis first.</p>
                )}
              </div>
            )}
          </AnalysisLayout>
        </div>
      )}
      </div>
    </AppShell>
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
