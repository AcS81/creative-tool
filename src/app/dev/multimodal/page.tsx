"use client";

import { useState } from "react";
import { isValidYouTubeUrl } from "../../../lib/youtube";
import { metaAxesMetadata } from "../../../lib/analysis/axisMetadata";
import type { VideoFingerprintJson } from "../../../lib/types";

type AnalysisResponse = {
  ok: boolean;
  fingerprint?: VideoFingerprintJson;
  unobservedCounts?: Record<string, number>;
  coverage?: {
    core?: Record<string, { observed: number; total: number; observedPct: number }>;
    advanced?: Record<string, { observed: number; total: number; observedPct: number; available?: boolean }>;
  };
  salvage?: {
    attempted?: boolean;
    sections?: string[];
  };
  advancedParse?: {
    audioText?: {
      strictError?: string;
      lenientError?: string;
      keys?: string[];
      preview?: string;
    };
    visualCross?: {
      strictError?: string;
      lenientError?: string;
      keys?: string[];
      preview?: string;
    };
    salvage?: Record<
      string,
      {
        strictError?: string;
        lenientError?: string;
        keys?: string[];
        preview?: string;
      }
    >;
  };
  passMetrics?: {
    core?: PassMetrics;
    coreRetry?: PassMetrics;
    advancedAudioText?: PassMetrics;
    advancedVisualCross?: PassMetrics;
    salvage?: Record<string, PassMetrics>;
    totals?: PassMetricsTotals;
  };
  raw?: unknown;
  error?: string;
  durationMs?: number;
};

type PassUsage = {
  promptTokens?: number;
  candidateTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
};

type PassMetrics = {
  durationMs: number;
  attempts: number;
  retries: number;
  status?: number;
  model?: string;
  usage?: PassUsage;
  estimatedCostUsd?: number;
};

type PassMetricsTotals = {
  durationMs: number;
  attempts: number;
  retries: number;
  usage?: PassUsage;
  estimatedCostUsd?: number;
};

export default function MultimodalDevPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [flagEnabled, setFlagEnabled] = useState(true);

  const runAnalysis = async () => {
    setError(null);
    setResult(null);
    if (!isValidYouTubeUrl(url)) {
      setError("Enter a valid YouTube URL");
      return;
    }
    setLoading(true);
    const start = performance.now();
    try {
      const res = await fetch("/api/dev/multimodal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, enableFlag: flagEnabled }),
      });
      const body = (await res.json()) as AnalysisResponse;
      setResult({
        ...body,
        durationMs: Math.round(performance.now() - start),
      });
      if (!body.ok) {
        setError(body.error ?? "Analysis failed");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const formatUsage = (usage?: PassUsage) => {
    if (!usage) return "tokens n/a";
    const parts = [
      usage.promptTokens !== undefined ? `in ${usage.promptTokens}` : null,
      usage.candidateTokens !== undefined ? `out ${usage.candidateTokens}` : null,
      usage.totalTokens !== undefined ? `total ${usage.totalTokens}` : null,
      usage.cachedTokens !== undefined ? `cached ${usage.cachedTokens}` : null,
    ].filter(Boolean);
    return parts.length ? `tokens ${parts.join(" / ")}` : "tokens n/a";
  };

  const formatCost = (cost?: number) =>
    typeof cost === "number" ? `$${cost.toFixed(4)}` : "cost n/a";

  const renderPass = (label: string, metrics?: PassMetrics) => {
    if (!metrics) return null;
    return (
      <div className="rounded border border-border bg-white px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-foreground">
          <span className="font-semibold">{label}</span>
          <span className="text-muted">
            {metrics.durationMs} ms · attempts {metrics.attempts} · retries {metrics.retries}
          </span>
        </div>
        <div className="mt-1 text-muted">
          {metrics.model ? `model ${metrics.model}` : "model n/a"} · {formatUsage(metrics.usage)} ·{" "}
          {formatCost(metrics.estimatedCostUsd)}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Multimodal Dev Runner</h1>
        <p className="text-sm text-muted">
          Exercises the same multimodal pipeline used by <code className="rounded bg-slate-100 px-1 py-0.5">/api/analyze</code>{" "}
          (analyzeVideoMultimodal + v2 fingerprint). Shows counts of unobserved metrics and coverage by section.
        </p>
        <p className="text-xs text-muted">
          Axis glossary:{" "}
          <a className="underline" href="/docs/axes_and_domains.md" target="_blank" rel="noreferrer">
            docs/axes_and_domains.md
          </a>
          .
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-white p-4 shadow-sm">
        <label className="text-sm font-medium text-foreground">YouTube URL</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
          placeholder="https://youtu.be/..."
        />
        <label className="inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={flagEnabled}
            onChange={(e) => setFlagEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Toggle rollout flag (pipeline remains multimodal)
        </label>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="w-fit rounded-md bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Running..." : "Run analysis"}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      {result ? (
        <div className="space-y-4 rounded-lg border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold text-foreground">{result.ok ? "Success" : "Failed"}</span>
            {typeof result.durationMs === "number" ? (
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-muted">
                {result.durationMs} ms
              </span>
            ) : null}
            {result.unobservedCounts ? (
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-muted">
                Unobserved metrics:{" "}
                {Object.entries(result.unobservedCounts)
                  .map(([k, v]) => `${k}:${v}`)
                  .join(" | ")}
              </span>
            ) : null}
            {result.coverage?.core ? (
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-muted">
                Coverage (core):{" "}
                {Object.entries(result.coverage.core)
                  .map(([k, v]) => `${k}:${v.observed}/${v.total}`)
                  .join(" | ")}
              </span>
            ) : null}
            {result.coverage?.advanced ? (
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-muted">
                Coverage (advanced):{" "}
                {Object.entries(result.coverage.advanced)
                  .map(([k, v]) => `${k}:${v.observed}/${v.total}`)
                  .join(" | ")}
              </span>
            ) : null}
            {result.passMetrics?.totals ? (
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-muted">
                Pass totals: {result.passMetrics.totals.durationMs} ms, attempts {result.passMetrics.totals.attempts}
                {typeof result.passMetrics.totals.estimatedCostUsd === "number"
                  ? `, est $${result.passMetrics.totals.estimatedCostUsd.toFixed(4)}`
                  : ""}
              </span>
            ) : null}
          </div>

          {result.fingerprint ? (
            <div className="space-y-3 text-sm">
              <p className="font-semibold text-foreground">Meta axes</p>
              <ul className="grid gap-2 md:grid-cols-2">
                {metaAxesMetadata.map((axis) => (
                  <li key={axis.id} className="rounded border border-border bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                      <span>{axis.label}</span>
                      <span>{Math.round(result.fingerprint?.metaAxes[axis.id as keyof typeof result.fingerprint.metaAxes] ?? 0)}</span>
                    </div>
                    <p className="text-xs text-muted">{axis.shortDescription}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.passMetrics ? (
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Pass metrics</p>
              <div className="grid gap-2 md:grid-cols-2">
                {renderPass("core", result.passMetrics.core)}
                {renderPass("core retry", result.passMetrics.coreRetry)}
                {renderPass("advanced audio/text", result.passMetrics.advancedAudioText)}
                {renderPass("advanced visual/cross", result.passMetrics.advancedVisualCross)}
                {result.passMetrics.salvage
                  ? Object.entries(result.passMetrics.salvage).map(([key, value]) =>
                      renderPass(`salvage: ${key}`, value),
                    )
                  : null}
              </div>
              {result.passMetrics.totals ? (
                <p className="text-xs text-muted">
                  Totals: {result.passMetrics.totals.durationMs} ms · attempts {result.passMetrics.totals.attempts} ·
                  retries {result.passMetrics.totals.retries} · {formatUsage(result.passMetrics.totals.usage)} ·{" "}
                  {formatCost(result.passMetrics.totals.estimatedCostUsd)}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="font-semibold text-foreground">Raw response (validated)</p>
            <pre className="max-h-80 overflow-auto rounded-md border border-border bg-slate-950 p-3 text-xs text-slate-50">
              {JSON.stringify(
                result.ok
                  ? {
                      fingerprint: result.fingerprint,
                      unobservedCounts: result.unobservedCounts,
                      advancedParse: result.advancedParse,
                      passMetrics: result.passMetrics,
                    }
                  : { error: result.error },
                null,
                2,
              )}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
