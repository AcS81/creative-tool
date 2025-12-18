import type { BeatSegment, TranscriptSegment } from "../lib/types";

type Props = {
  beats?: BeatSegment[];
  durationSeconds?: number;
  transcriptSegments?: TranscriptSegment[];
};

const palette = [
  "#f97316", // orange
  "#fbbf24", // amber
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ec4899", // pink
  "#f43f5e", // rose
];

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const formatSeconds = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) return `${secs}s`;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m`;
  }
  return `${mins}m ${secs}s`;
};

const truncate = (text: string, max = 80) => {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
};

const resolveArcLabel = (
  beat: BeatSegment,
  transcriptSegments?: TranscriptSegment[],
  fallback?: string,
) => {
  if (transcriptSegments?.length) {
    let best: TranscriptSegment | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const segment of transcriptSegments) {
      const within = beat.startSeconds >= segment.startSeconds && beat.startSeconds <= segment.endSeconds;
      if (within) return truncate(segment.text.trim());
      const dist = Math.min(
        Math.abs(beat.startSeconds - segment.startSeconds),
        Math.abs(beat.startSeconds - segment.endSeconds),
      );
      if (dist < bestDist) {
        best = segment;
        bestDist = dist;
      }
    }
    if (best?.text) return truncate(best.text.trim());
  }
  return fallback ?? beat.label ?? "Arc";
};

export function MiniArcBar({ beats, durationSeconds, transcriptSegments }: Props) {
  const sortedBeats = [...(beats ?? [])].sort((a, b) => a.startSeconds - b.startSeconds);
  if (sortedBeats.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="cs-kicker text-[10px]">Narrative arcs</p>
            <p className="text-base font-semibold text-foreground">Mini-arc timeline</p>
          </div>
          <p className="text-xs text-muted">Detected arcs will appear here.</p>
        </div>
        <div className="rounded-lg border border-dashed border-border bg-surface-strong p-4 text-sm text-muted">
          No mini-arcs detected for this video.
        </div>
      </div>
    );
  }

  const detectedDuration =
    durationSeconds && durationSeconds > 0
      ? durationSeconds
      : Math.max(...sortedBeats.map((beat) => beat.endSeconds), 1);

  const segments = sortedBeats.map((beat, idx) => {
    const color = palette[idx % palette.length];
    const label = resolveArcLabel(beat, transcriptSegments, beat.label || `Arc ${idx + 1}`);
    const startPct = clamp((beat.startSeconds / Math.max(detectedDuration, 1)) * 100, 0, 100);
    const endPct = clamp((beat.endSeconds / Math.max(detectedDuration, 1)) * 100, 0, 100);
    return { beat, color, label, startPct, endPct };
  });

  const transitions = segments.slice(0, -1).map((segment, idx) => {
    const next = segments[idx + 1];
    const gapSeconds = Math.max(0, next.beat.startSeconds - segment.beat.endSeconds);
    const transitionSeconds = Math.max(gapSeconds, 0.5); // keep a visible blend even if arcs butt together
    const widthPct = clamp((transitionSeconds / Math.max(detectedDuration, 1)) * 100, 1, 25);
    const centerSeconds = (segment.beat.endSeconds + next.beat.startSeconds) / 2;
    const centerPct = clamp((centerSeconds / Math.max(detectedDuration, 1)) * 100, 0, 100);
    const leftPct = clamp(centerPct - widthPct / 2, 0, 100);
    return {
      fromColor: segment.color,
      toColor: next.color,
      leftPct,
      widthPct,
      centerSeconds,
      gapSeconds,
    };
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="cs-kicker text-[10px]">Narrative arcs</p>
          <p className="text-base font-semibold text-foreground">Mini-arc timeline</p>
        </div>
        <p className="text-xs text-muted">Color shifts mark arc transitions.</p>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-surface-strong p-4 shadow-sm">
        <div className="relative h-6 overflow-hidden rounded-full border border-border/70 bg-white">
          {segments.map((segment, idx) => {
            const widthPct = Math.max(2, segment.endPct - segment.startPct);
            return (
              <div
                key={`${segment.label}-${idx}`}
                className="absolute top-0 h-full"
                style={{ width: `${widthPct}%`, left: `${segment.startPct}%`, backgroundColor: segment.color }}
                title={`${segment.label} (${formatSeconds(segment.beat.endSeconds - segment.beat.startSeconds)})`}
              />
            );
          })}
          {transitions.map((transition, idx) => (
            <div
              key={`transition-${idx}`}
              className="pointer-events-none absolute top-0 h-full opacity-90"
              style={{
                left: `${transition.leftPct}%`,
                width: `${transition.widthPct}%`,
                backgroundImage: `linear-gradient(90deg, ${transition.fromColor}, ${transition.toColor})`,
              }}
              title={`Transition ~${formatSeconds(transition.gapSeconds)} gap`}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted">
          <span>0s</span>
          <span>{formatSeconds(detectedDuration)}</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-foreground/90">
          {segments.slice(0, 6).map((segment, idx) => {
            const color = segment.color;
            return (
              <span
                key={`${segment.label}-legend-${idx}`}
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white px-2 py-1 shadow-sm"
              >
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="font-semibold">{segment.label}</span>
                <span className="text-muted">
                  {Math.round(segment.beat.startSeconds)}s–{Math.round(segment.beat.endSeconds)}s
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
