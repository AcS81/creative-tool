export function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-surface-strong px-3 py-1 text-xs font-semibold text-muted">
      {label}
    </span>
  );
}
