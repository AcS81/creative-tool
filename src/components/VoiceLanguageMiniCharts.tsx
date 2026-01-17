import type { VideoFingerprintJson, TimelinePoint } from "../lib/types";

type HumorTimingItem = {
  setupStart?: number;
  punchStart?: number;
  deltaSeconds?: number;
  landed?: boolean;
};

type Spark = {
  path: string;
  markers: Array<TimelinePoint & { x: number; y: number }>;
};

const buildSparkline = (points?: TimelinePoint[], width = 260, height = 90): Spark => {
  const timeline = (points ?? []).filter(
    (p) => typeof p.value === "number" && typeof p.timeSeconds === "number",
  );
  if (!timeline.length) return { path: "", markers: [] };

  const maxTime = Math.max(...timeline.map((p) => p.timeSeconds ?? 0), 1);
  const values = timeline.map((p) => p.value ?? 0);
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);

  const markers = timeline.map((point) => {
    const x = ((point.timeSeconds ?? 0) / maxTime) * width;
    const y = height - (((point.value ?? 0) - min) / span) * height;
    return { ...point, x, y };
  });

  const path = markers
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");

  return { path, markers };
};

const formatSeconds = (seconds?: number | null) => {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds)) return "";
  if (seconds < 90) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m${secs.toString().padStart(2, "0")}s`;
};

export function VoicePaceMiniChart({ prosodyArc }: { prosodyArc?: VideoFingerprintJson["prosodyArc"] }) {
  const timeline =
    prosodyArc?.paceVariabilityPct?.timeline ?? prosodyArc?.paceMeanWpm?.timeline ?? prosodyArc?.energyDriftDbPerMin?.timeline;
  const spark = buildSparkline(timeline, 280, 110);
  const paceVariance = prosodyArc?.paceVariabilityPct?.score;
  const drift = prosodyArc?.withinSegmentPaceChangePct?.score;

  if (!spark.path && !paceVariance && !drift) return null;

  return (
    <div className="rounded-lg border border-border/70 bg-white/85 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Pace timeline</p>
          <p className="text-[12px] text-muted">Smoothed pace swings across the video.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {typeof paceVariance === "number" ? (
            <span className="cs-badge text-[12px]">Pace variance {Math.round(paceVariance)}/100</span>
          ) : null}
          {typeof drift === "number" ? (
            <span className="cs-badge bg-surface-strong text-[12px]">Drift {Math.round(drift)}/100</span>
          ) : null}
        </div>
      </div>
      {spark.path ? (
        <div className="mt-3 rounded-md bg-surface-strong/70 p-2">
          <svg viewBox="0 0 280 110" className="h-28 w-full text-accent" role="img" aria-label="Pace timeline">
            <defs>
              <linearGradient id="paceFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#ff2f45" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#f6c344" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <path d={`${spark.path} L280,110 L0,110 Z`} fill="url(#paceFill)" stroke="none" />
            <path d={spark.path} fill="none" stroke="currentColor" strokeWidth="2.2" />
            {spark.markers.map((point, idx) => (
              <circle
                key={`${point.timeSeconds}-${idx}`}
                cx={point.x}
                cy={point.y}
                r={3.5}
                className="fill-white stroke-accent stroke-2"
              >
                <title>{`${formatSeconds(point.timeSeconds)} • ${Math.round(point.value ?? 0)}/100`}</title>
              </circle>
            ))}
          </svg>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">No pace timeline available.</p>
      )}
    </div>
  );
}

export function LanguageTimingMiniChart({
  languageTexture,
}: {
  languageTexture?: VideoFingerprintJson["languageTexture"];
}) {
  const humorItems =
    (languageTexture?.humorTimingScore?.items as HumorTimingItem[] | undefined)
      ?.filter((item) => typeof item.setupStart === "number" && typeof item.punchStart === "number")
      ?.slice(0, 4) ?? [];
  const questionCounts = languageTexture?.questionRate?.counts;
  const questionBadge =
    questionCounts && typeof questionCounts.rhetorical === "number" && typeof questionCounts.genuine === "number"
      ? `Question mix: ${questionCounts.genuine}/${questionCounts.rhetorical} genuine vs rhetorical`
      : null;

  if (!humorItems.length && !questionBadge) return null;

  return (
    <div className="rounded-lg border border-border/70 bg-white/85 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Humor timing</p>
          <p className="text-[12px] text-muted">Setup → punch spacing and question balance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {typeof languageTexture?.humorTimingScore?.score === "number" ? (
            <span className="cs-badge text-[12px]">
              Humor timing {Math.round(languageTexture.humorTimingScore.score)}/100
            </span>
          ) : null}
          {questionBadge ? <span className="cs-badge bg-surface-strong text-[12px]">{questionBadge}</span> : null}
        </div>
      </div>
      {humorItems.length ? (
        <div className="mt-3 space-y-2">
          {humorItems.map((item, idx) => {
            const delta =
              typeof item.deltaSeconds === "number"
                ? Math.round(item.deltaSeconds)
                : Math.round((item.punchStart ?? 0) - (item.setupStart ?? 0));
            const landed = item.landed === true;
            return (
              <div
                key={`humor-${idx}`}
                className="flex items-center justify-between rounded-md border border-border/70 bg-surface-strong/80 px-3 py-2 text-sm text-foreground"
                title={`Setup at ${formatSeconds(item.setupStart)} → Punch at ${formatSeconds(item.punchStart)}`}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
                  <span className="text-xs font-semibold">Δ {Number.isFinite(delta) ? `${delta}s` : "n/a"}</span>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-muted">
                  <span>{formatSeconds(item.setupStart)}</span>
                  <span>→</span>
                  <span>{formatSeconds(item.punchStart)}</span>
                  {landed ? <span className="text-emerald-700">Landed</span> : <span className="text-red-600">Missed</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">No humor timing spans detected.</p>
      )}
    </div>
  );
}
