import type { DomainProfile } from "../lib/types/fingerprint";
import { DomainRadar } from "./DomainRadar";

export function DomainCard({ name, profile }: { name: string; profile: DomainProfile }) {
  return (
    <div className="cs-card p-6">
      <p className="cs-kicker text-[11px]">{name}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{profile.primaryArchetype}</p>
      {profile.secondaryArchetype ? (
        <p className="text-sm text-muted">Secondary: {profile.secondaryArchetype}</p>
      ) : null}
      <p className="mt-2 text-sm text-muted">{profile.summaryText}</p>

      <DomainRadar profile={profile} />

      {profile.highlights?.length ? (
        <div className="mt-4 space-y-1 text-sm text-foreground">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Highlights</p>
          <ul className="list-disc space-y-1 pl-4">
            {profile.highlights.slice(0, 3).map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
