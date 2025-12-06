import type { DomainProfile } from "../lib/types/fingerprint";

export function DomainCard({ name, profile }: { name: string; profile: DomainProfile }) {
  return (
    <div className="rounded-lg border border-border bg-white/80 p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">{name}</p>
      <p className="mt-1 text-lg font-semibold">{profile.primaryArchetype}</p>
      {profile.secondaryArchetype ? (
        <p className="text-sm text-muted">Secondary: {profile.secondaryArchetype}</p>
      ) : null}
      <p className="mt-2 text-sm text-muted">{profile.summaryText}</p>

      <div className="mt-4 space-y-2">
        {profile.scores.slice(0, 5).map((score) => (
          <div key={score.key} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{score.label}</span>
              <span>{Math.round(score.value)}/100</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-accent"
                style={{ width: `${Math.min(Math.max(score.value, 0), 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
