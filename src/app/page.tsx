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

type RecentAnalysisSummary = {
  id: string;
  youtubeVideoId: string;
  title: string;
  channelTitle?: string | null;
  thumbnailUrl?: string | null;
  createdAt: string;
  status: string;
  durationSeconds: number;
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
  const [disconnectMessage, setDisconnectMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "voice" | "language" | "narrative" | "visual" | "editing" | "sound" | "performance"
  >("overview");
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const domainProfiles = result?.fingerprint.perDomain;
  const supporting = result?.fingerprint.supporting;

  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysisSummary[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const validTabs = new Set(tabKeys);
    if (tabParam && validTabs.has(tabParam as (typeof tabKeys)[number]) && tabParam !== activeTab) {
      setActiveTab(tabParam as typeof activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setHistoryLoading(true);
        setHistoryError(null);
        const res = await fetch("/api/history");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setHistoryError(body?.message ?? "Could not load recent analyses.");
          return;
        }
        const body = (await res.json()) as { items: RecentAnalysisSummary[] };
        setRecentAnalyses(body.items ?? []);
      } catch {
        setHistoryError("Could not load recent analyses.");
      } finally {
        setHistoryLoading(false);
      }
    };

    void loadHistory();
  }, []);

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
    setDisconnectMessage(null);

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
      // Refresh recent analyses to include the new result.
      try {
        const historyRes = await fetch("/api/history");
        if (historyRes.ok) {
          const historyBody = (await historyRes.json()) as { items: RecentAnalysisSummary[] };
          setRecentAnalyses(historyBody.items ?? []);
        }
      } catch {
        // Ignore history refresh errors; main analysis already succeeded.
      }
    } catch {
      setError("Could not analyze this URL. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnectMessage(null);
    try {
      const res = await fetch("/api/auth/youtube/disconnect", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDisconnectMessage(body?.message ?? "Could not revoke YouTube tokens.");
        return;
      }
      const body = await res.json();
      setDisconnectMessage(`YouTube connection revoked (${body.revoked ?? 0} token(s) removed).`);
    } catch {
      setDisconnectMessage("Could not revoke YouTube tokens. Please try again.");
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
          <div className="mt-4 space-y-2 rounded-md border border-border bg-surface-strong p-4 text-sm">
            <p className="font-semibold text-foreground">Analytics & privacy</p>
            <p className="text-muted">
              No raw video is stored. Only URLs, derived fingerprints, and optional YouTube Analytics metrics are saved.
              Tokens are revocable at any time.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <a
                className="cs-button inline-flex w-fit justify-center text-xs"
                href="/api/auth/youtube/start"
              >
                Connect YouTube
              </a>
              <button
                type="button"
                className="cs-button-secondary text-xs"
                onClick={handleDisconnect}
              >
                Disconnect YouTube
              </button>
              {disconnectMessage && <span className="text-xs text-muted">{disconnectMessage}</span>}
            </div>
          </div>
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
                  {result.fingerprint.hasPerformanceData && result.fingerprint.performanceProfile && (
                    <div className="mt-4 rounded-md border border-border/80 bg-surface-strong p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                        Performance at a glance
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {result.fingerprint.performanceProfile.summaryText}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                        <span>
                          Hook retention: {Math.round(result.fingerprint.performanceProfile.scores.hookRetention)}%
                        </span>
                        <span>•</span>
                        <span>
                          CTR:{" "}
                          {typeof result.fingerprint.performanceProfile.metrics.ctr === "number"
                            ? `${result.fingerprint.performanceProfile.metrics.ctr.toFixed(1)}%`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  )}
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

                <div className="grid gap-4 md:grid-cols-[minmax(0,2fr),minmax(0,1.1fr)]">
                  <div className="cs-panel p-4 shadow-sm">
                    <h3 className="text-sm font-semibold text-muted">Recent analyses (this browser)</h3>
                    {historyLoading && (
                      <p className="mt-2 text-sm text-muted">Loading recent analyses…</p>
                    )}
                    {!historyLoading && historyError && (
                      <p className="mt-2 text-sm text-red-600">{historyError}</p>
                    )}
                    {!historyLoading && !historyError && recentAnalyses.length === 0 && (
                      <p className="mt-2 text-sm text-muted">
                        Run an analysis to see it listed here.
                      </p>
                    )}
                    {!historyLoading && !historyError && recentAnalyses.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {recentAnalyses.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-surface-strong p-3 text-sm"
                          >
                            <div className="flex items-center gap-3">
                              {item.thumbnailUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.thumbnailUrl}
                                  alt={item.title}
                                  className="h-10 w-16 rounded-md object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-16 items-center justify-center rounded-md bg-accent/10 text-[10px] font-semibold text-accent">
                                  {item.youtubeVideoId.slice(0, 6)}
                                </div>
                              )}
                              <div className="space-y-0.5">
                                <p className="text-sm font-semibold text-foreground line-clamp-2">
                                  {item.title}
                                </p>
                                <p className="text-xs text-muted">
                                  {item.channelTitle ?? "Unknown channel"}
                                </p>
                                <p className="text-[11px] text-muted">
                                  {new Date(item.createdAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="cs-button-secondary shrink-0 text-xs"
                              onClick={async () => {
                                try {
                                  setLoading(true);
                                  setError(null);
                                  const res = await fetch(`/api/history/${item.id}`);
                                  if (!res.ok) {
                                    const body = await res.json().catch(() => ({}));
                                    setError(
                                      body?.message ?? "Could not load this past analysis.",
                                    );
                                    return;
                                  }
                                  const loaded = (await res.json()) as AnalyzeResponse;
                                  setResult(loaded);
                                  setActiveTab("overview");
                                } catch {
                                  setError("Could not load this past analysis.");
                                } finally {
                                  setLoading(false);
                                }
                              }}
                            >
                              View analysis
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="cs-panel p-4 shadow-sm">
                    <p className="cs-kicker text-[10px]">Tip</p>
                    <p className="mt-1 text-sm text-muted">
                      History is kept anonymously in this browser only. Clearing cookies or using
                      another browser starts a fresh session.
                    </p>
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
