import type { DomainProfile } from "../lib/types/fingerprint";

export function DomainCard({ name, profile }: { name: string; profile: DomainProfile }) {
  return (
    <div className="rounded-lg border border-border bg-white/80 p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">{name}</p>
      <p className="mt-1 text-lg font-semibold">{profile.archetype}</p>
      <p className="mt-2 text-sm text-muted">{profile.summary}</p>

      <div className="mt-4 space-y-2">
        {profile.axes.slice(0, 5).map((axis) => (
          <div key={axis.key} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{axis.label}</span>
              <span>{Math.round(axis.value)}/100</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-accent"
                style={{ width: `${Math.min(Math.max(axis.value, 0), 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
