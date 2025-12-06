import type { TranscriptSegment } from "../lib/types/fingerprint";

type Beat = {
  startSeconds: number;
  endSeconds: number;
  label: string;
};

export function DomainTimeline({
  beats,
  transcriptSegments,
}: {
  beats?: Beat[];
  transcriptSegments?: TranscriptSegment[];
}) {
  if (!beats?.length && !transcriptSegments?.length) {
    return null;
  }

  const items = beats?.length ? beats : transcriptSegments?.map((seg) => ({ ...seg, label: seg.text })) ?? [];
  const maxTime = Math.max(...items.map((item) => item.endSeconds), 1);

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Timeline</p>
      <div className="space-y-2">
        {items.slice(0, 8).map((item, idx) => {
          const startPct = Math.max(0, Math.min(100, (item.startSeconds / maxTime) * 100));
          const endPct = Math.max(0, Math.min(100, (item.endSeconds / maxTime) * 100));
          const width = Math.max(4, endPct - startPct);
          return (
            <div key={`${item.label}-${idx}`} className="flex items-center gap-2 text-xs text-muted">
              <span className="w-14 text-right text-[11px] tabular-nums">
                {Math.round(item.startSeconds)}s
              </span>
              <div className="relative h-2 w-full rounded bg-slate-200">
                <div
                  className="absolute left-0 top-0 h-2 rounded bg-accent/80"
                  style={{ marginLeft: `${startPct}%`, width: `${width}%` }}
                />
              </div>
              <span className="w-10 text-left text-[11px] tabular-nums">
                {Math.round(item.endSeconds)}s
              </span>
              <span className="line-clamp-1 w-40 text-foreground">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
