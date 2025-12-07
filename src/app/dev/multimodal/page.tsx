"use client";

import { useState } from "react";
import { isValidYouTubeUrl } from "../../../lib/youtube";
import { metaAxesMetadata } from "../../../lib/analysis/axisMetadata";
import type { VideoFingerprintJson } from "../../../lib/types";

type AnalysisResponse = {
  ok: boolean;
  fingerprint?: VideoFingerprintJson;
  fromFallback?: boolean;
  unobservedCounts?: Record<string, number>;
  raw?: unknown;
  error?: string;
  durationMs?: number;
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

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Multimodal Dev Runner</h1>
        <p className="text-sm text-muted">
          Runs the v2 multimodal analysis pipeline. Feature flag toggles the client. Raw response is redacted to core
          fields only.
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
          Enable analysis_v2_multimodal flag
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
            {result.fromFallback ? (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">Used fallback</span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">Primary path</span>
            )}
            {result.unobservedCounts ? (
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-muted">
                Unobserved metrics:{" "}
                {Object.entries(result.unobservedCounts)
                  .map(([k, v]) => `${k}:${v}`)
                  .join(" | ")}
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

          <div className="space-y-2">
            <p className="font-semibold text-foreground">Raw response (validated)</p>
            <pre className="max-h-80 overflow-auto rounded-md border border-border bg-slate-950 p-3 text-xs text-slate-50">
              {JSON.stringify(
                result.ok
                  ? {
                      fingerprint: result.fingerprint,
                      unobservedCounts: result.unobservedCounts,
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
