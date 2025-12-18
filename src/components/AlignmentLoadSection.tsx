import type { VideoFingerprintJson } from "../lib/types";

type Props = {
  fingerprint?: VideoFingerprintJson | null;
};

const formatScore = (value?: number) => {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return `${Math.round(value)}`;
};

const sparklinePath = (values: number[], width = 200, height = 60) => {
  if (!values.length) return "";
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;

  return values
    .map((v, idx) => {
      const x = idx * step;
      const y = height - ((v - min) / span) * height;
      return `${idx === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
};

export function AlignmentLoadSection({ fingerprint }: Props) {
  if (!fingerprint) return null;

  const audioVisual = fingerprint.visualEditAlignment?.audioVisualEmphasisAlignment;
  const beatsEdits = fingerprint.visualEditAlignment?.beatsVsEditsAlignment;
  const modality = fingerprint.modalityBalance?.modalityOverReliance;
  const redundancy = fingerprint.modalityBalance?.redundancyVsComplementarity;
  const load = fingerprint.cognitiveLoad?.loadPerSecond;
  const loadTimeline = load?.timeline?.map((t) => t.value).slice(0, 24) ?? [];
  const loadPath = loadTimeline.length > 1 ? sparklinePath(loadTimeline) : "";

  const anyAlignment =
    audioVisual?.observed !== false ||
    beatsEdits?.observed !== false ||
    modality?.observed !== false ||
    redundancy?.observed !== false;

  if (!anyAlignment && !loadPath) {
    return null;
  }

  return (
    <div className="cs-panel space-y-3 border border-border/80 bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="cs-kicker text-[10px]">Alignment & Load</p>
          <p className="text-sm text-muted">How well emphasis lines up across modes and where load spikes.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-muted">
          <span className="cs-pill bg-surface-strong text-[11px]">Audio-visual</span>
          <span className="cs-pill bg-surface-strong text-[11px]">Beats vs edits</span>
          <span className="cs-pill bg-surface-strong text-[11px]">Cognitive load</span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {audioVisual ? (
          <div className="rounded border border-border/60 bg-white/80 p-3">
            <p className="text-xs font-semibold text-muted">Audio-visual emphasis</p>
            <p className="text-2xl font-bold text-foreground">{formatScore(audioVisual.score)}</p>
            <p className="text-[12px] text-muted">Peaks in audio align with cuts/zooms/graphics.</p>
          </div>
        ) : null}
        {beatsEdits ? (
          <div className="rounded border border-border/60 bg-white/80 p-3">
            <p className="text-xs font-semibold text-muted">Beats vs edits</p>
            <p className="text-2xl font-bold text-foreground">{formatScore(beatsEdits.score)}</p>
            <p className="text-[12px] text-muted">Edits reinforcing narrative transitions.</p>
          </div>
        ) : null}
        {modality ? (
          <div className="rounded border border-border/60 bg-white/80 p-3">
            <p className="text-xs font-semibold text-muted">Modality over-reliance</p>
            <p className="text-2xl font-bold text-foreground">{formatScore(modality.score)}</p>
            <p className="text-[12px] text-muted">
              {modality.proportions
                ? `Dominant: ${Object.entries(modality.proportions)
                    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                    .slice(0, 1)
                    .map(([k, v]) => `${k.replace("Pct", "")} ${Math.round((v ?? 0) * 100)}%`)
                    .join("")}`
                : "One mode may be carrying most of the meaning."}
            </p>
          </div>
        ) : null}
        <div className="rounded border border-border/60 bg-white/80 p-3">
          <p className="text-xs font-semibold text-muted">Cognitive load trend</p>
          {loadPath ? (
            <svg viewBox="0 0 200 60" className="mt-1 h-16 w-full text-accent" role="presentation">
              <path d={loadPath} fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          ) : (
            <p className="mt-2 text-sm text-muted">No load timeline available.</p>
          )}
          <p className="text-[12px] text-muted">
            Higher values mean denser pacing or visuals; spikes mark overload moments.
          </p>
        </div>
      </div>
    </div>
  );
}
