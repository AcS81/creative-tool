import { resolveAxisMetadata } from "../lib/analysis/axisMetadata";
import type { AxisDetail, TimelinePoint, VideoFingerprintJson } from "../lib/types";

type Props = {
  fingerprint?: VideoFingerprintJson | null;
};

const formatScore = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return `${Math.round(value)}`;
};

const formatSeconds = (seconds?: number | null) => {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds)) return "";
  if (seconds < 90) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m${secs.toString().padStart(2, "0")}s`;
};

const buildSparkline = (points?: TimelinePoint[], width = 260, height = 90) => {
  const timeline = (points ?? []).filter(
    (p) => typeof p.value === "number" && typeof p.timeSeconds === "number",
  );
  if (!timeline.length)
    return {
      path: "",
      markers: [] as Array<TimelinePoint & { x: number; y: number }>,
      scaleX: () => 0,
      scaleY: () => height,
    };

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

  const scaleX = (timeSeconds = 0) => ((timeSeconds ?? 0) / maxTime) * width;
  const scaleY = (value = 0) => height - (((value ?? 0) - min) / span) * height;

  return { path, markers, scaleX, scaleY };
};

const pickDetail = (
  candidates: string[],
  axisDetails?: Record<string, AxisDetail>,
): { metaLabel?: string; text?: string } | null => {
  if (!axisDetails) return null;
  for (const key of candidates) {
    const meta = resolveAxisMetadata(key);
    const ids = new Set<string>([key]);
    if (meta?.id) ids.add(meta.id);
    meta?.aliases?.forEach((alias) => ids.add(alias));
    for (const id of ids) {
      const detail = axisDetails[id];
      if (!detail) continue;
      const observed = detail.observed !== false && detail.rawValue !== "unobserved";
      if (!observed) continue;
      const text = detail.explanation || detail.rawValue;
      return { metaLabel: meta?.label ?? key, text };
    }
  }
  return null;
};

export function AlignmentLoadSection({ fingerprint }: Props) {
  if (!fingerprint) return null;

  const audioVisual = fingerprint.visualEditAlignment?.audioVisualEmphasisAlignment;
  const beatsEdits = fingerprint.visualEditAlignment?.beatsVsEditsAlignment;
  const modality = fingerprint.modalityBalance?.modalityOverReliance;
  const redundancy = fingerprint.modalityBalance?.redundancyVsComplementarity;
  const load = fingerprint.cognitiveLoad?.loadPerSecond;
  const axisDetails = fingerprint.supporting?.axisDetails;

  const audioTimeline = audioVisual?.timeline;
  const audioSpark = audioTimeline
    ? buildSparkline(audioTimeline, 280, 120)
    : { path: "", markers: [], scaleX: () => 0, scaleY: () => 0 };

  const beatsTimeline =
    beatsEdits?.timeline?.filter(
      (p) => typeof p.value === "number" && typeof p.timeSeconds === "number",
    ) ?? [];
  const beatsSorted = [...beatsTimeline].sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
  const beatsWorst = beatsSorted.slice(0, 2);
  const beatsBest = beatsSorted.slice(-2).reverse();
  const beatsList = [...beatsWorst, ...beatsBest].filter(
    (point, idx, arr) => arr.findIndex((p) => p.timeSeconds === point.timeSeconds && p.value === point.value) === idx,
  );

  const loadSpark = load?.timeline?.length ? buildSparkline(load.timeline, 320, 120) : null;
  const loadHighlights =
    fingerprint.cognitiveLoad?.loadHighlights?.spans?.filter(
      (span) =>
        typeof span.startSeconds === "number" &&
        typeof span.endSeconds === "number" &&
        span.startSeconds <= span.endSeconds,
    ) ?? [];
  const loadSpikes =
    loadSpark && loadHighlights.length
      ? loadHighlights.map((span, idx) => {
          const center = (span.startSeconds + span.endSeconds) / 2;
          const value = typeof span.value === "number" ? span.value : undefined;
          return {
            ...span,
            id: `${span.label ?? "spike"}-${idx}`,
            center,
            x: loadSpark.scaleX(center),
            y: loadSpark.scaleY(value ?? 0),
          };
        })
      : [];

  const dominantModality = modality?.proportions
    ? Object.entries(modality.proportions)
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
        .map(([k, v]) => `${k.replace("Pct", "")} ${Math.round((v ?? 0) * 100)}%`)[0]
    : undefined;
  const worstEditAlignment =
    beatsEdits?.timeline && beatsEdits.timeline.length
      ? beatsEdits.timeline
          .filter((p) => typeof p.value === "number" && typeof p.timeSeconds === "number")
          .reduce(
            (acc, point) =>
              !acc || (point.value as number) < acc.value
                ? { value: point.value as number, time: point.timeSeconds as number }
                : acc,
            null as { value: number; time: number } | null,
          )
      : null;
  const alignmentNote =
    dominantModality && worstEditAlignment
      ? `Dominant modality: ${dominantModality}. Lowest beat/edit alignment near ${Math.round(worstEditAlignment.time)}s.`
      : dominantModality
        ? `Dominant modality: ${dominantModality}.`
        : worstEditAlignment
          ? `Lowest beat/edit alignment near ${Math.round(worstEditAlignment.time)}s.`
          : undefined;

  const anyAlignment =
    audioVisual?.observed !== false ||
    beatsEdits?.observed !== false ||
    modality?.observed !== false ||
    redundancy?.observed !== false;

  const audioDetail = pickDetail(
    ["alignment.audio_visual_emphasis_alignment", "audioVisualEmphasisAlignment"],
    axisDetails,
  );
  const beatsDetail = pickDetail(["alignment.beats_vs_edits_alignment", "beatsVsEditsAlignment"], axisDetails);
  const modalityDetail = pickDetail(["balance.modality_over_reliance", "modalityOverReliance"], axisDetails);
  const redundancyDetail = pickDetail(["balance.redundancy_vs_complementarity", "redundancyVsComplementarity"], axisDetails);

  if (!anyAlignment && !loadSpark?.path) {
    return (
      <div className="cs-panel space-y-2 border border-border/80 bg-surface p-4 text-sm text-muted shadow-sm">
        <p className="font-semibold text-foreground">Alignment & Load</p>
        <p>Alignment and load metrics were not observed for this analysis.</p>
        <a
          href="/docs/axes_and_domains.md"
          target="_blank"
          rel="noreferrer"
          className="text-[12px] font-semibold text-accent underline"
        >
          What do these metrics mean?
        </a>
      </div>
    );
  }

  return (
    <div className="cs-panel space-y-4 border border-border/80 bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="cs-kicker text-[10px]">Alignment & Load</p>
          <p className="text-sm text-muted">How emphasis lines up across modes and where alignment breaks.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span className="cs-pill bg-surface-strong text-[11px]">Audio-visual</span>
          <span className="cs-pill bg-surface-strong text-[11px]">Beats vs edits</span>
          <span className="cs-pill bg-surface-strong text-[11px]">Cognitive load</span>
          <a
            href="/docs/axes_and_domains.md"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-semibold text-accent underline"
          >
            Alignment glossary
          </a>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.25fr,1fr,0.9fr]">
        {audioVisual ? (
          <div
            className="rounded-lg border border-border/80 bg-white/80 p-4 shadow-sm"
            title={audioDetail?.text ?? "Offset between vocal emphasis and visual emphasis"}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-muted">
                  {audioDetail?.metaLabel ?? "Audio-visual emphasis"}
                </p>
                <p className="text-[12px] text-muted">Mini-chart: peaks lining up across modes</p>
              </div>
              <span className="cs-badge text-[12px]">{formatScore(audioVisual.score)} / 100</span>
            </div>
            {audioSpark.path ? (
              <div className="mt-3 rounded-md bg-surface-strong/60 p-2">
                <svg
                  viewBox="0 0 280 120"
                  className="h-28 w-full text-accent"
                  role="img"
                  aria-label="Audio-visual emphasis alignment timeline"
                >
                  <defs>
                    <linearGradient id="audioFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#ff2f45" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#f6c344" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>
                  <path d={`${audioSpark.path} L280,120 L0,120 Z`} fill="url(#audioFill)" stroke="none" />
                  <path d={audioSpark.path} fill="none" stroke="currentColor" strokeWidth="2.4" />
                  {audioSpark.markers.map((point, idx) => (
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
              <p className="mt-3 text-sm text-muted">No emphasis timeline available.</p>
            )}
          </div>
        ) : null}

        {beatsEdits ? (
          <div
            className="rounded-lg border border-border/80 bg-white/80 p-4 shadow-sm"
            title={beatsDetail?.text ?? "Distance between beat changes and nearest edit"}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-muted">
                  {beatsDetail?.metaLabel ?? "Beats vs edits"}
                </p>
                <p className="text-[12px] text-muted">Best/worst deltas near narrative beats</p>
              </div>
              <span className="cs-badge text-[12px]">{formatScore(beatsEdits.score)} / 100</span>
            </div>
            <div className="mt-3 space-y-2 text-sm text-muted">
              {beatsList.length ? (
                beatsList.map((point, idx) => {
                  const delta =
                    typeof beatsEdits.score === "number" && typeof point.value === "number"
                      ? Math.round(point.value - beatsEdits.score)
                      : null;
                  const tone =
                    delta === null ? "text-muted" : delta >= 0 ? "text-emerald-700" : "text-red-700";
                  return (
                    <div
                      key={`${point.timeSeconds}-${point.value}-${idx}`}
                      className="flex items-center justify-between rounded-md border border-border/70 bg-surface-strong/80 px-3 py-2"
                      title={`At ${formatSeconds(point.timeSeconds)}: ${Math.round(point.value ?? 0)}/100`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
                        <span className="text-xs font-semibold text-foreground">
                          {formatSeconds(point.timeSeconds) || "Beat"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted">{Math.round(point.value ?? 0)}/100</span>
                        {delta !== null ? (
                          <span className={`text-[12px] font-semibold ${tone}`}>
                            {delta >= 0 ? `+${delta}` : delta}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted">No beat/edit alignment timeline available.</p>
              )}
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-border/80 bg-white/80 p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-muted" title={modalityDetail?.text}>
                {modalityDetail?.metaLabel ?? "Modality over-reliance"}
              </p>
              <p className="text-[12px] text-muted">Who is carrying meaning? Show balance vs overload.</p>
            </div>
            <span className="cs-badge text-[12px]">
              {modality ? `${formatScore(modality.score)} / 100` : "—"}
            </span>
          </div>
          {dominantModality ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="cs-pill bg-surface-strong/80 text-[12px] font-semibold text-accent-contrast">
                Dominant: {dominantModality}
              </span>
              {redundancy ? (
                <span
                  className="cs-pill bg-surface-strong/80 text-[12px]"
                  title={redundancyDetail?.text ?? "Redundant vs complementary mix"}
                >
                  Complementarity {formatScore(redundancy.score)} / 100
                </span>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">No modality proportions observed.</p>
          )}
        </div>
      </div>

      {alignmentNote ? (
        <p className="text-[12px] text-muted" title={alignmentNote}>
          {alignmentNote}
        </p>
      ) : null}

      <div className="rounded-lg border border-border/80 bg-white/80 p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-muted">Cognitive load timeline</p>
            <p className="text-[12px] text-muted">Hover for values; spikes mark overload moments.</p>
          </div>
          <span className="cs-badge text-[12px]">{load ? `${formatScore(load.score)} / 100` : "—"}</span>
        </div>
        {loadSpark?.path ? (
          <div className="mt-3 rounded-md bg-surface-strong/60 p-2">
            <svg
              viewBox="0 0 320 120"
              className="h-28 w-full text-accent"
              role="img"
              aria-label="Cognitive load timeline"
            >
              <defs>
                <linearGradient id="loadFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f6c344" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#ff2f45" stopOpacity="0.05" />
                </linearGradient>
              </defs>
              <path d={`${loadSpark.path} L320,120 L0,120 Z`} fill="url(#loadFill)" stroke="none" />
              <path d={loadSpark.path} fill="none" stroke="currentColor" strokeWidth="2.4" />
              {loadSpark.markers.map((point, idx) => (
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
              {loadSpikes.map((spike) => (
                <circle
                  key={spike.id}
                  cx={spike.x}
                  cy={spike.y}
                  r={5}
                  className="fill-accent stroke-white stroke-2"
                >
                  <title>{`${spike.label ?? "Load spike"} • ${formatSeconds(spike.center)}${
                    typeof spike.value === "number" ? ` • ${Math.round(spike.value)}/100` : ""
                  }${spike.alignedBeat ? ` • ${spike.alignedBeat}` : ""}`}</title>
                </circle>
              ))}
            </svg>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            No load timeline available.{" "}
            <a
              href="/docs/axes_and_domains.md"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-accent underline"
            >
              Learn how load is computed.
            </a>
          </p>
        )}
        {loadSpikes.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {loadSpikes.map((spike) => (
              <span
                key={spike.id}
                className="cs-pill bg-surface-strong/80 text-[12px]"
                title={`${spike.label ?? "Load spike"} • ${formatSeconds(spike.center)}`}
              >
                {spike.label ?? "Load spike"} • {formatSeconds(spike.center)}
                {typeof spike.value === "number" ? ` • ${Math.round(spike.value)}/100` : ""}
                {spike.alignedBeat ? ` • ${spike.alignedBeat}` : ""}
              </span>
            ))}
          </div>
        ) : null}
        <p className="mt-2 text-[12px] text-muted">
          Higher values mean denser pacing or visuals; spikes highlight overload or peak complexity.
        </p>
      </div>
    </div>
  );
}
