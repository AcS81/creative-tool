import { Area, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PerformanceProfile } from "../lib/types";

type Props = {
  performanceProfile?: PerformanceProfile;
  hasPerformanceData?: boolean;
  insights?: string[];
  youtubeConnected?: boolean;
  performanceError?: string;
};

const formatPercent = (value?: number) =>
  typeof value === "number" ? `${value.toFixed(1)}%` : "—";

const roleColor = (role?: string) => {
  const lower = (role ?? "").toLowerCase();
  if (lower.includes("hook")) return "#10b981";
  if (lower.includes("setup")) return "#3b82f6";
  if (lower.includes("escalation")) return "#6366f1";
  if (lower.includes("payoff") || lower.includes("climax")) return "#8b5cf6";
  if (lower.includes("outro") || lower.includes("cta")) return "#f59e0b";
  if (lower.includes("break")) return "#94a3b8";
  return "#a855f7";
};

export function PerformanceView({
  performanceProfile,
  hasPerformanceData,
  insights,
  youtubeConnected,
  performanceError,
}: Props) {
  if (!hasPerformanceData || !performanceProfile) {
    const fallbackText = youtubeConnected
      ? performanceError
        ? `YouTube is connected but analytics could not be retrieved: ${performanceError}`
        : "YouTube is connected. Analyze a video you own to pull retention, CTR, and engagement."
      : "Connect YouTube via OAuth to pull retention, CTR, and engagement for owned videos.";

    return (
      <div className="cs-card space-y-3 p-6 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="cs-kicker text-[10px]">Performance</p>
            <p className="text-base font-semibold text-foreground">No performance data yet</p>
            <p className="text-muted">{fallbackText}</p>
          </div>
          <span className="cs-badge text-[12px]">
            {youtubeConnected ? "YouTube connected" : "YouTube not connected"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!youtubeConnected ? (
            <a href="/api/auth/youtube/start" className="cs-button inline-flex w-fit justify-center text-xs">
              Connect YouTube
            </a>
          ) : null}
          <span className="cs-pill text-[12px]">Retention • CTR • Engagement</span>
        </div>
      </div>
    );
  }

  const metrics = performanceProfile.metrics;
  const series = metrics.retentionSeries ?? [];
  const performanceInsights = insights ?? performanceProfile.insights ?? [];
  const beatMarkers = Array.from(
    new Map(
      series
        .filter((p) => p.beatRole || p.beatLabel)
        .map((p) => {
          const label = (p.beatRole ?? p.beatLabel) as string;
          const key = `${label}-${Math.round((p.timeRatio ?? 0) * 100)}`;
          return [key, { label, timeRatio: p.timeRatio }];
        }),
    ).values(),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-white/90 p-5 shadow-sm">
        <div>
          <p className="cs-kicker text-[10px]">Performance summary</p>
          <p className="text-base text-foreground">{performanceProfile.summaryText}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Views" value={metrics.views?.toLocaleString() ?? "—"} />
          <Metric label="CTR" value={formatPercent(metrics.ctr)} />
          <Metric label="Avg view duration" value={formatSeconds(metrics.avgViewDurationSeconds)} />
          <Metric label="Likes" value={metrics.likes?.toLocaleString() ?? "—"} />
          <Metric label="Comments" value={metrics.comments?.toLocaleString() ?? "—"} />
          <Metric label="Late drop-off" value={`${Math.round(performanceProfile.scores.lateDropOffSeverity)} pts`} />
        </div>
      </div>

      {performanceInsights.length > 0 && (
        <div className="rounded-lg border border-border bg-white/90 p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-muted">Performance coaching</p>
            <span className="cs-pill bg-surface-strong/80 text-[11px] font-semibold">Auto-generated</span>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-foreground/85">
            {performanceInsights.map((insight, idx) => (
              <li key={idx}>{insight}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-border bg-white/90 p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-muted">Retention over time</p>
            {beatMarkers.length > 0 && (
              <p className="text-[11px] text-muted">
                Beat markers show hook/setup/payoff aligned to the timeline.
              </p>
            )}
          </div>
          <p className="text-xs text-muted">0–100% of video</p>
        </div>
        {series.length === 0 ? (
          <p className="text-sm text-muted">No retention samples available.</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <defs>
                  <linearGradient id="retentionGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#ff2f45" stopOpacity={0.34} />
                    <stop offset="100%" stopColor="#f6c344" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="timeRatio"
                  tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value: any, _name, payload) => {
                    const beat = payload?.payload?.beatRole ?? payload?.payload?.beatLabel;
                    const scene = payload?.payload?.sceneLabel;
                    const parts = [`${value.toFixed ? value.toFixed(1) : value}% retained`];
                    if (beat) parts.push(`Beat: ${beat}`);
                    if (scene) parts.push(`Scene: ${scene}`);
                    return parts.join(" • ");
                  }}
                  labelFormatter={(label) => `${Math.round(Number(label) * 100)}% of video`}
                />
                <Area
                  type="monotone"
                  dataKey="audienceRetention"
                  stroke="none"
                  fill="url(#retentionGradient)"
                  fillOpacity={0.6}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="audienceRetention"
                  stroke="#ff2f45"
                  strokeWidth={2.2}
                  dot={false}
                  isAnimationActive={false}
                />
                {beatMarkers.map((marker) => (
                  <ReferenceLine
                    key={`${marker.label}-${marker.timeRatio}`}
                    x={marker.timeRatio}
                    stroke={roleColor(marker.label)}
                    strokeDasharray="3 3"
                    label={{
                      value: marker.label,
                      position: "top",
                      fill: "#475569",
                      fontSize: 10,
                    }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border/70 bg-surface-strong p-3">
    <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
    <p className="text-base font-semibold text-foreground">{value}</p>
  </div>
);

const formatSeconds = (value?: number) => {
  if (!Number.isFinite(value)) return "—";
  const mins = Math.floor((value as number) / 60);
  const secs = Math.floor((value as number) % 60);
  return `${mins}m ${secs}s`;
};
