"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { isValidYouTubeUrl } from "../lib/youtube";
import type { DomainProfile, VideoFingerprintJson } from "../lib/types";
import { RadarChartOverview } from "../components/RadarChartOverview";
import { AnalysisLayout } from "../components/Layout/AnalysisLayout";
import { DomainTimeline } from "../components/DomainTimeline";
import { AppShell } from "../components/AppShell";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Chip } from "../components/Chip";
import { DomainView } from "../components/DomainView";
import { DomainRadar } from "../components/DomainRadar";
import { resolveAxisMetadata } from "../lib/analysis/axisMetadata";
import { DeliveryRelationalSection } from "../components/DeliveryRelationalSection";
import { MiniArcBar } from "../components/MiniArcBar";
import { AlignmentLoadSection } from "../components/AlignmentLoadSection";
import { sampleAnalysisResult, sampleMetadata } from "../lib/sampleAnalysis";
import { PerformanceView } from "../components/PerformanceView";
import { performanceCoaching } from "../lib/analysis/performanceCoaching";
import { LanguageTimingMiniChart, VoicePaceMiniChart } from "../components/VoiceLanguageMiniCharts";

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
  diagnostics?: {
    source?: string;
    performanceAttached?: boolean;
    performanceErrorType?: string;
    performanceErrorMessage?: string;
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

type YoutubeConnectionStatus = {
  performanceEnabled: boolean;
  connected: boolean;
  tokens?: number;
  error?: string;
};

const tabKeys = [
  "overview",
  "voice",
  "delivery",
  "narrative",
  "visual",
  "editing",
  "sound",
  "performance",
] as const;

type TabKey = (typeof tabKeys)[number];

const Callout = ({ label, value, description }: { label: string; value: string; description: string }) => (
  <div className="rounded-md border border-border/70 bg-surface-strong p-3 shadow-sm">
    <p className="text-xs font-semibold text-muted">{label}</p>
    <p className="text-lg font-semibold text-foreground">{value}</p>
    <p className="text-[12px] text-muted">{description}</p>
  </div>
);

const metricValue = (value?: string | number | null) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return `${Math.round(value)}`;
  const trimmed = String(value).trim();
  return trimmed.toLowerCase() === "unobserved" || trimmed === "" ? null : trimmed;
};

const clampScore = (value?: number | null, fallback = 50) => Math.max(0, Math.min(100, value ?? fallback));

const findScore = (profile: DomainProfile | undefined, keys: string[]) => {
  if (!profile) return undefined;
  for (const score of profile.scores) {
    const meta = resolveAxisMetadata(score.key);
    const aliases = meta?.aliases ?? [];
    const candidates = new Set<string>([score.key]);
    if (meta?.id) candidates.add(meta.id);
    aliases.forEach((alias) => candidates.add(alias));
    for (const key of keys) {
      if (candidates.has(key)) return score.value;
    }
  }
  return undefined;
};

const deriveTonePlacement = (fingerprint?: VideoFingerprintJson | null) => {
  const arousal =
    findScore(fingerprint?.perDomain.voiceProfile, [
      "speaking_rate",
      "loudness_range",
      "pitch_variation",
      "energy",
      "voiceIntensity",
    ]) ??
    fingerprint?.metaAxes.voiceIntensity ??
    50;

  const valence =
    findScore(fingerprint?.perDomain.languageProfile, ["humor", "warmth", "positivity", "sentiment"]) ??
    findScore(fingerprint?.perDomain.voiceProfile, ["warmth", "positivity", "sentiment"]) ??
    50;

  return { arousal: clampScore(arousal), valence: clampScore(valence) };
};

const deriveConnectionPlacement = (fingerprint?: VideoFingerprintJson | null) => {
  const closeness =
    findScore(fingerprint?.perDomain.voiceProfile, ["warmth", "expression"]) ??
    findScore(fingerprint?.perDomain.languageProfile, ["storyPresence", "self_disclosure", "selfDisclosure"]) ??
    findScore(fingerprint?.perDomain.narrativeProfile, ["story_presence", "storyPresence"]) ??
    50;

  const care =
    findScore(fingerprint?.perDomain.languageProfile, [
      "explanationWeight",
      "teaching_vs_riffing",
      "directive_density",
      "references",
    ]) ??
    findScore(fingerprint?.perDomain.narrativeProfile, ["structure", "hooks"]) ??
    50;

  return { closeness: clampScore(closeness), care: clampScore(care) };
};

function HomeContent() {
  const howItWorksSteps = [
    {
      title: "Drop a link",
      description: "Paste any public YouTube URL to start the scan.",
      icon: "🔗",
    },
    {
      title: "Run the fingerprint",
      description: "We score voice, narrative, visuals, editing, and sound.",
      icon: "📊",
    },
    {
      title: "Get coaching",
      description: "See archetype, nearest references, and improvement tips.",
      icon: "🎯",
    },
  ];

  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [youtubeStatus, setYoutubeStatus] = useState<YoutubeConnectionStatus | null>(null);
  const [youtubeStatusLoading, setYoutubeStatusLoading] = useState(true);
  const [youtubeMessage, setYoutubeMessage] = useState<{ text: string; tone?: "success" | "error" | "muted" } | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const domainProfiles = result?.fingerprint.perDomain;
  const supporting = result?.fingerprint.supporting;
  const deliveryTone = deriveTonePlacement(result?.fingerprint);
  const deliveryConnection = deriveConnectionPlacement(result?.fingerprint);

  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysisSummary[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadYoutubeStatus = useCallback(async () => {
    try {
      setYoutubeStatusLoading(true);
      const res = await fetch("/api/auth/youtube/status");
      if (!res.ok) {
        throw new Error("Could not load status");
      }
      const body = (await res.json()) as YoutubeConnectionStatus & { error?: string };
      setYoutubeStatus(body);
      if (body.error) {
        setYoutubeMessage({ text: body.error, tone: "error" });
      }
    } catch {
      setYoutubeStatus(null);
      setYoutubeMessage({ text: "Could not load YouTube connection status.", tone: "error" });
    } finally {
      setYoutubeStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const normalizedTab = tabParam === "language" ? "delivery" : tabParam;
    const validTabs = new Set(tabKeys);
    if (normalizedTab && validTabs.has(normalizedTab as TabKey) && normalizedTab !== activeTab) {
      setActiveTab(normalizedTab as TabKey);
    }
    if (!normalizedTab && typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "");
      if (hash && validTabs.has(hash as TabKey) && hash !== activeTab) {
        setActiveTab(hash as TabKey);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    void loadYoutubeStatus();
  }, [loadYoutubeStatus]);

  useEffect(() => {
    const youtubeParam = searchParams.get("youtube");
    const reason = searchParams.get("reason");
    if (!youtubeParam) return;

    if (youtubeParam === "connected") {
      setYoutubeMessage({
        text: "YouTube connected. Analyze videos you own to see performance data.",
        tone: "success",
      });
      void loadYoutubeStatus();
    } else if (youtubeParam === "denied") {
      setYoutubeMessage({
        text: `YouTube connection was not authorized${reason ? `: ${reason}` : ""}.`,
        tone: "error",
      });
    } else if (youtubeParam === "error") {
      setYoutubeMessage({
        text: "Could not complete YouTube OAuth. Please try again.",
        tone: "error",
      });
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete("youtube");
    next.delete("reason");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [loadYoutubeStatus, pathname, router, searchParams]);

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
    router.replace(`${pathname}?${next.toString()}#${tab}`, { scroll: false });
  };

  const loadSample = () => {
    setError(null);
    setLoading(false);
    setResult({
      videoAnalysisId: "sample-analysis",
      fingerprint: {
        ...sampleAnalysisResult.fingerprint,
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
        languageProfile: ["Sample: balanced delivery and takes."],
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
    setYoutubeMessage(null);

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
    setYoutubeMessage(null);
    try {
      const res = await fetch("/api/auth/youtube/disconnect", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setYoutubeMessage({
          text: body?.message ?? "Could not revoke YouTube tokens.",
          tone: "error",
        });
        return;
      }
      const body = await res.json();
      const revoked = typeof body?.revoked === "number" ? body.revoked : 0;
      setYoutubeMessage({
        text:
          revoked > 0
            ? `YouTube connection revoked (${revoked} token${revoked === 1 ? "" : "s"} removed).`
            : "No YouTube connection found to revoke.",
        tone: "success",
      });
      await loadYoutubeStatus();
    } catch {
      setYoutubeMessage({ text: "Could not revoke YouTube tokens. Please try again.", tone: "error" });
    }
  };

  const handleLoadHistoryAnalysis = async (id: string) => {
    setLoading(true);
    setError(null);
    setActiveTab("overview");
    try {
      const res = await fetch(`/api/history/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message ?? "Could not load this past analysis.");
        return;
      }
      const loaded = (await res.json()) as AnalyzeResponse;
      setResult(loaded);
    } catch {
      setError("Could not load this past analysis.");
    } finally {
      setLoading(false);
    }
  };

  const youtubeConnected = youtubeStatus?.connected === true;
  const performanceReady = youtubeStatus?.performanceEnabled !== false;
  const youtubeStatusBadge = youtubeStatusLoading ? (
    <span className="cs-pill bg-surface-strong text-[11px] text-muted">Checking YouTube…</span>
  ) : youtubeStatus?.performanceEnabled === false ? (
    <span className="cs-pill bg-amber-100 text-[11px] font-semibold text-amber-800">Performance mode off</span>
  ) : youtubeConnected ? (
    <span className="cs-pill bg-emerald-100 text-[11px] font-semibold text-emerald-700">YouTube connected</span>
  ) : (
    <span className="cs-pill bg-surface-strong text-[11px] text-muted">YouTube not connected</span>
  );
  const youtubeCtaLabel = youtubeConnected ? "Reconnect YouTube" : "Connect YouTube";

  const voiceCallout =
    metricValue(result?.fingerprint.prosodyArc?.paceVariabilityPct?.value) &&
    result?.fingerprint.prosodyArc?.paceVariabilityPct?.observed !== false ? (
      <Callout
        label="Pace variance"
        value={metricValue(result?.fingerprint.prosodyArc?.paceVariabilityPct?.value) as string}
        description="How much your pace swings from average."
      />
    ) : null;
  const narrativeCallout =
    metricValue(result?.fingerprint.narrativeArc?.timeToHookSeconds?.value) &&
    result?.fingerprint.narrativeArc?.timeToHookSeconds?.observed !== false ? (
      <Callout
        label="Time to hook"
        value={metricValue(result?.fingerprint.narrativeArc?.timeToHookSeconds?.value) as string}
        description="Seconds until the first clear hook lands."
      />
    ) : null;
  const visualCallout =
    metricValue(result?.fingerprint.visualEditAlignment?.silenceForEmphasisFidelity?.value) &&
    result?.fingerprint.visualEditAlignment?.silenceForEmphasisFidelity?.observed !== false ? (
      <Callout
        label="Silence fidelity"
        value={metricValue(result?.fingerprint.visualEditAlignment?.silenceForEmphasisFidelity?.value) as string}
        description="Silences align with beats or emphasis."
      />
    ) : null;
  const soundCallout =
    metricValue(result?.fingerprint.visualEditAlignment?.audioVisualEmphasisAlignment?.value) &&
    result?.fingerprint.visualEditAlignment?.audioVisualEmphasisAlignment?.observed !== false ? (
      <Callout
        label="Alignment note"
        value={metricValue(result?.fingerprint.visualEditAlignment?.audioVisualEmphasisAlignment?.value) as string}
        description="Audio emphasis lining up with visual peaks."
      />
    ) : null;

  const diagnostics = result?.diagnostics;
  const showDiagnostics =
    diagnostics &&
    (diagnostics.source !== "mock" ||
      diagnostics.multimodalFallbackUsed ||
      diagnostics.advancedMetricsDefaulted ||
      diagnostics.lowerConfidence ||
      diagnostics.advancedMetricsObserved === false);
  const diagnosticChips = showDiagnostics
    ? [
        diagnostics?.source ? { label: `Source: ${diagnostics.source}`, tone: "muted" as const } : null,
        diagnostics?.advancedMetricsObserved === false
          ? { label: "Advanced metrics missing", tone: "warn" as const }
          : diagnostics?.advancedMetricsObserved === true
            ? { label: "Advanced metrics observed", tone: "success" as const }
            : null,
        diagnostics?.advancedMetricsDefaulted
          ? {
              label: diagnostics.advancedMetricsDefaultReason
                ? `Defaulted: ${diagnostics.advancedMetricsDefaultReason}`
                : "Defaulted metrics",
              tone: "warn" as const,
            }
          : null,
        diagnostics?.multimodalFallbackUsed
          ? { label: "Fallback ingest used", tone: "warn" as const }
          : null,
        diagnostics?.lowerConfidence
          ? {
              label: diagnostics.lowerConfidenceReason
                ? `Lower confidence: ${diagnostics.lowerConfidenceReason}`
                : "Lower confidence",
              tone: "alert" as const,
            }
          : null,
      ].filter(Boolean)
    : [];

  return (
    <AppShell>
      <div className="flex w-full flex-col gap-8 py-2 sm:py-3">
        <section className="cs-card w-full p-8 sm:p-9 backdrop-blur">
          <div className="grid gap-6 md:grid-cols-[1.4fr,1fr] md:items-center">
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <p className="cs-kicker">CreatorSight</p>
                <h1 className="cs-heading leading-tight text-foreground">
                  YouTube creative fingerprint with instant coaching.
                </h1>
                <p className="cs-body max-w-3xl text-muted">
                  Paste a YouTube link to score voice, narrative, visuals, editing, and sound—then see the closest reference creators and actionable tips.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <a className="cs-button" href="#analysis">
                  Analyze a video
                </a>
                <button type="button" className="cs-button-secondary" onClick={loadSample}>
                  Try a sample
                </button>
                <span className="cs-badge bg-white/80 text-[11px] font-semibold text-accent-contrast">
                  YouTube + amber UI
                </span>
              </div>
            <div className="flex flex-wrap items-center gap-2">
              {youtubeStatusBadge}
              {youtubeMessage ? (
                <span
                  role="status"
                  aria-live="polite"
                  className={`text-xs ${
                    youtubeMessage.tone === "error"
                      ? "text-red-600"
                      : youtubeMessage.tone === "success"
                        ? "text-emerald-700"
                        : "text-muted"
                  }`}
                >
                  {youtubeMessage.text}
                </span>
              ) : null}
            </div>
          </div>

            <form
              id="analysis"
              onSubmit={handleSubmit}
              className="grid gap-4 rounded-2xl border border-border bg-white/80 p-5 shadow-sm backdrop-blur md:p-6"
            >
              <div>
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
                {error ? (
                  <p className="mt-2 text-sm text-red-600" role="alert" aria-live="assertive">
                    {error}
                  </p>
                ) : null}
              </div>
              <button type="submit" className="cs-button justify-center" disabled={loading}>
                {loading ? "Analyzing..." : "Analyze video"}
              </button>
              <div className="flex items-start gap-3 rounded-md border border-border bg-surface-strong/70 p-3 text-xs text-muted">
                <span className="text-lg">💡</span>
                <div>
                  <p className="font-semibold text-foreground">What to expect</p>
                  <p>Validate URL, run mock or Gemini pipeline, then show archetype, radar, and domain tabs.</p>
                  <a
                    className={`cs-link mt-2 inline-flex items-center text-xs font-semibold ${
                      performanceReady ? "text-accent hover:underline" : "text-muted"
                    }`}
                    href="/api/auth/youtube/start"
                  >
                    {youtubeCtaLabel}
                  </a>
                  <p className="text-[11px] text-muted">
                    {performanceReady
                      ? youtubeConnected
                        ? "Analyze owned videos to surface retention and CTR."
                        : "Connect YouTube to unlock performance data."
                      : "Performance mode is disabled in this environment."}
                  </p>
                </div>
              </div>
            </form>
          </div>
        </section>

        <section className="grid gap-3 rounded-2xl border border-border bg-surface p-5 shadow-sm md:grid-cols-3 md:gap-4">
          {howItWorksSteps.map((step) => (
            <div
              key={step.title}
              className="flex gap-3 rounded-xl border border-border bg-surface-strong/70 p-4 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-amber text-lg">
                {step.icon}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                <p className="text-xs text-muted">{step.description}</p>
              </div>
            </div>
          ))}
        </section>

      {result && (
        <div className="cs-card w-full p-6">
          <MiniArcBar
            beats={supporting?.beats}
            durationSeconds={result.metadata?.durationSeconds}
            transcriptSegments={supporting?.transcriptSegments}
          />
        </div>
      )}

      {loading && (
        <div className="cs-card space-y-4 p-6" role="status" aria-live="polite">
          <p className="text-sm font-semibold text-muted">Loading your analysis…</p>
          <div className="grid gap-3">
            <div className="h-4 w-1/2 animate-pulse rounded bg-surface-strong" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-surface-strong" />
            <div className="h-40 animate-pulse rounded bg-surface-strong" />
          </div>
          <p className="text-xs text-muted">
            New analyses may take a couple of minutes; loading saved ones is quicker.
          </p>
        </div>
      )}

      {!loading && error && !result && (
        <div className="cs-card space-y-2 p-6 border-red-200 bg-red-50" role="alert" aria-live="assertive">
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
                className={`cs-button inline-flex w-fit justify-center text-xs ${
                  performanceReady ? "" : "cursor-not-allowed opacity-60"
                }`}
                href="/api/auth/youtube/start"
                aria-disabled={!performanceReady}
              >
                {youtubeCtaLabel}
              </a>
              <button
                type="button"
                className="cs-button-secondary text-xs disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleDisconnect}
                disabled={!performanceReady || youtubeStatusLoading || !youtubeConnected}
              >
                Disconnect YouTube
              </button>
              {youtubeStatusBadge}
              {youtubeMessage ? (
                <span
                  className={`text-xs ${
                    youtubeMessage.tone === "error"
                      ? "text-red-600"
                      : youtubeMessage.tone === "success"
                        ? "text-emerald-700"
                        : "text-muted"
                  }`}
                >
                  {youtubeMessage.text}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted">
              {performanceReady
                ? youtubeConnected
                  ? "YouTube is connected. Performance metrics will populate when analyzing videos you own."
                  : "Connect with the YouTube account that owns your videos to unlock performance data."
                : "Performance mode is disabled in this environment."}
            </p>
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
                    <div className="flex flex-wrap gap-2" role="status" aria-live="polite">
                      <Chip label={`Voice: ${result.fingerprint.perDomain.voiceProfile.primaryArchetype}`} />
                      <Chip
                        label={`Delivery: ${result.fingerprint.perDomain.languageProfile.primaryArchetype}`}
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
                      {diagnosticChips.length ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {diagnosticChips.map((chip, idx) => (
                            <span
                              key={`${chip?.label}-${idx}`}
                              className={`cs-pill text-[11px] ${
                                chip?.tone === "warn"
                                  ? "border-amber-300 bg-amber-100 text-amber-800"
                                  : chip?.tone === "alert"
                                    ? "border-red-300 bg-red-50 text-red-700"
                                    : chip?.tone === "success"
                                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                      : "bg-surface-strong text-muted"
                              }`}
                            >
                              {chip?.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
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

                <AlignmentLoadSection fingerprint={result.fingerprint} />

                <div className="grid gap-4 md:grid-cols-[2fr,1.2fr]">
                  <div className="space-y-3 rounded-md border border-border bg-surface p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-muted">Insights</p>
                      <a
                        href="/docs/axes_and_domains.md"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-foreground underline"
                      >
                        What do these axes mean?
                      </a>
                    </div>
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
                    extra={
                      <div className={`grid gap-3 ${voiceCallout ? "md:grid-cols-2" : ""}`}>
                        <VoicePaceMiniChart prosodyArc={result.fingerprint.prosodyArc} />
                        {voiceCallout}
                      </div>
                    }
                  />
                )}
                {activeTab === "delivery" && domainProfiles?.languageProfile && (
                  <DomainView
                    name="Your Delivery"
                    domain="language"
                    profile={domainProfiles.languageProfile}
                    visual={<DomainRadar profile={domainProfiles.languageProfile} />}
                    insights={result.domainInsights?.languageProfile}
                    detailOverride={
                      <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
                        <DeliveryRelationalSection
                          tone={deliveryTone}
                          connection={deliveryConnection}
                          axisDetails={result.fingerprint.supporting?.axisDetails}
                        />
                        <LanguageTimingMiniChart languageTexture={result.fingerprint.languageTexture} />
                      </div>
                    }
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
                      <div className="grid gap-3 md:grid-cols-2">
                        {narrativeCallout}
                        <DomainTimeline
                          beats={supporting?.beats}
                          transcriptSegments={supporting?.transcriptSegments}
                          silenceSpans={result.fingerprint.visualEditAlignment?.silenceForEmphasisFidelity?.spans?.map(
                            (span) => ({
                              startSeconds: span.startSeconds,
                              endSeconds: span.endSeconds,
                              label: span.label ?? (span.alignedBeat ? `Silence near ${span.alignedBeat}` : undefined),
                            }),
                          )}
                        />
                      </div>
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
                    extra={
                      <div className="grid gap-3 md:grid-cols-2">
                        <DomainTimeline
                          beats={supporting?.sceneSegments}
                          silenceSpans={result.fingerprint.visualEditAlignment?.silenceForEmphasisFidelity?.spans?.map(
                            (span) => ({
                              startSeconds: span.startSeconds,
                              endSeconds: span.endSeconds,
                              label: span.label ?? (span.alignedBeat ? `Silence near ${span.alignedBeat}` : undefined),
                            }),
                          )}
                        />
                        {visualCallout}
                      </div>
                    }
                  />
                )}
                {activeTab === "editing" && domainProfiles?.editingProfile && (
                  <DomainView
                    name="Your Editing"
                    domain="editing"
                    profile={domainProfiles.editingProfile}
                    visual={<DomainRadar profile={domainProfiles.editingProfile} />}
                    insights={result.domainInsights?.editingProfile}
                    extra={
                      <div className="grid gap-3 md:grid-cols-2">
                        {visualCallout}
                        <DomainTimeline
                          beats={supporting?.sceneSegments}
                          silenceSpans={result.fingerprint.visualEditAlignment?.silenceForEmphasisFidelity?.spans?.map(
                            (span) => ({
                              startSeconds: span.startSeconds,
                              endSeconds: span.endSeconds,
                              label: span.label ?? (span.alignedBeat ? `Silence near ${span.alignedBeat}` : undefined),
                            }),
                          )}
                        />
                      </div>
                    }
                  />
                )}
                {activeTab === "sound" && domainProfiles?.soundProfile && (
                  <DomainView
                    name="Your Sound"
                    domain="sound"
                    profile={domainProfiles.soundProfile}
                    visual={<DomainRadar profile={domainProfiles.soundProfile} />}
                    insights={result.domainInsights?.soundProfile}
                    extra={soundCallout}
                  />
                )}
                {activeTab === "performance" && (
                  <PerformanceView
                    performanceProfile={result.fingerprint.performanceProfile}
                    hasPerformanceData={result.fingerprint.hasPerformanceData}
                    youtubeConnected={youtubeConnected}
                    performanceError={youtubeConnected ? result.diagnostics?.performanceErrorMessage : undefined}
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

      <div className="cs-card w-full p-6">
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
                {recentAnalyses.map((item) => {
                  const statusLabel =
                    item.status === "complete"
                      ? "Complete"
                      : item.status === "failed"
                        ? "Failed"
                        : "Processing";
                  const statusBadgeClasses =
                    item.status === "complete"
                      ? "bg-emerald-100 text-emerald-700"
                      : item.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-800";

                  return (
                    <li
                      key={item.id}
                      className="flex flex-col gap-3 rounded-md border border-border/70 bg-surface-strong p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
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
                          <p className="line-clamp-2 text-sm font-semibold text-foreground">
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
                      <div className="flex items-center justify-end gap-2">
                        <span className={`cs-pill px-2 py-1 text-[11px] font-semibold ${statusBadgeClasses}`}>
                          {statusLabel}
                        </span>
                        <button
                          type="button"
                          className="cs-button-secondary shrink-0 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => handleLoadHistoryAnalysis(item.id)}
                          disabled={item.status !== "complete" || loading}
                        >
                          View analysis
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="cs-panel p-4 shadow-sm">
            <p className="cs-kicker text-[10px]">Tip</p>
            <p className="mt-1 text-sm text-muted">
              History is kept anonymously in this browser only. Clearing cookies or using another browser
              starts a fresh session.
            </p>
          </div>
        </div>
      </div>
      </div>
    </AppShell>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
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
