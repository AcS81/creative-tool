import type { DomainProfile } from "../lib/types";

type Props = {
  profile: DomainProfile;
};

export function DomainScoreBars({ profile }: Props) {
  const scores = profile.scores.slice(0, 6);

  return (
    <div className="space-y-3">
      {scores.map((score) => {
        const value = Math.max(0, Math.min(100, score.value));
        return (
          <div key={score.key} className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-muted">
              <span>{score.label}</span>
              <span className="text-foreground">{Math.round(value)} / 100</span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-strong">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-accent to-indigo-500"
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
