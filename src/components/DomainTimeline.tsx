import type { TranscriptSegment } from "../lib/types/fingerprint";

type Beat = {
  startSeconds: number;
  endSeconds: number;
  label: string;
  role?: string;
  devices?: string[];
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

  const items: Beat[] =
    beats?.length
      ? beats
      : transcriptSegments?.map((seg) => ({ ...seg, label: seg.text, role: undefined, devices: [] })) ?? [];
  const maxTime = Math.max(...items.map((item) => item.endSeconds), 1);

  const roleColor = (label: string, role?: string) => {
    const lower = (role ?? label).toLowerCase();
    if (lower.includes("hook")) return "bg-emerald-500";
    if (lower.includes("setup")) return "bg-blue-500";
    if (lower.includes("escalation")) return "bg-indigo-500";
    if (lower.includes("payoff") || lower.includes("climax")) return "bg-purple-500";
    if (lower.includes("outro") || lower.includes("cta")) return "bg-amber-500";
    return "bg-slate-400";
  };

  const deviceLabel = (device: string) => {
    const map: Record<string, string> = {
      foreshadow: "Foreshadow",
      callback: "Callback",
      pattern_interrupt: "Pattern interrupt",
      contrast: "Contrast",
      analogy: "Analogy",
      reversal: "Reversal",
      stakes_change: "Stakes change",
    };
    return map[device] ?? device;
  };

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
                  className={`absolute left-0 top-0 h-2 rounded ${roleColor(item.label, item.role)}`}
                  // Prefer normalized role for color and label if present.
                  style={{ marginLeft: `${startPct}%`, width: `${width}%` }}
                />
              </div>
              <span className="w-10 text-left text-[11px] tabular-nums">
                {Math.round(item.endSeconds)}s
              </span>
              <div className="flex flex-1 items-center gap-2">
                <span className="line-clamp-1 w-32 text-foreground">{item.role ?? item.label}</span>
                {item.devices?.slice(0, 3).map((device) => (
                  <span
                    key={`${device}-${idx}`}
                    className="rounded-full bg-slate-100 px-2 py-[2px] text-[10px] text-foreground"
                  >
                    {deviceLabel(device)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
