import type { ReactNode } from "react";
import type { DomainProfile } from "../lib/types";
import { Chip } from "./Chip";
import { DomainScoreBars } from "./DomainScoreBars";
import { describeArchetype, type DomainKey } from "../lib/archetypes/descriptions";
import { resolveAxisMetadata } from "../lib/analysis/axisMetadata";

type Props = {
  name: string;
  domain: DomainKey;
  profile: DomainProfile;
  visual?: ReactNode;
  tags?: string[];
  insights?: string[];
  extra?: ReactNode;
  detailOverride?: ReactNode;
};

export function DomainView({ name, domain, profile, visual, tags, insights, extra, detailOverride }: Props) {
  const derivedTags = profile.scores
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((score) => {
      if (score.value >= 70) return `Strong ${score.label}`;
      if (score.value >= 55) return `Leaning ${score.label}`;
      return `${score.label} present`;
    });

  const tagList = tags && tags.length > 0 ? tags : [...derivedTags, ...(profile.highlights ?? [])];
  const archetypeDescription = describeArchetype(domain, profile.primaryArchetype);
  const secondaryDescription = describeArchetype(domain, profile.secondaryArchetype);
  return (
    <div className="cs-card p-6 space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="cs-kicker text-[11px]">{name}</p>
          <p className="text-xl font-semibold text-foreground">
            {archetypeDescription?.title ?? profile.primaryArchetype}
          </p>
          {profile.secondaryArchetype ? (
            <p className="text-sm text-muted">
              Secondary: {secondaryDescription?.title ?? profile.secondaryArchetype}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-muted">
            {archetypeDescription?.description ?? profile.summaryText}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip label="Domain scores" />
          {profile.secondaryArchetype ? <Chip label="Blended style" /> : null}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.1fr,1fr]">
        {visual ? <div className="mt-2">{visual}</div> : null}
        <div className="rounded-lg border border-border/60 bg-surface-strong p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Score mix</p>
          <DomainScoreBars profile={profile} />
        </div>
      </div>

      {detailOverride ? (
        detailOverride
      ) : (
        <div className="grid gap-3 rounded-lg border border-border/60 bg-surface-strong p-4 shadow-sm md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Axis details</p>
            <ul className="space-y-2 text-sm text-foreground">
              {profile.scores.map((score) => {
                const meta = resolveAxisMetadata(score.key);
                const detail = profile.axisDetails?.[meta?.id ?? score.key];
                const value = Math.round(Math.max(0, Math.min(100, score.value)));
                const observed = detail?.observed !== false && detail?.rawValue !== "unobserved";
                return (
                  <li key={score.key} className="rounded border border-border/50 bg-white/60 px-3 py-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span>{meta?.label ?? score.label ?? score.key}</span>
                      <span>{value} / 100</span>
                    </div>
                    {detail?.rawValue ? (
                      <p className="text-[12px] text-foreground/80">Raw: {detail.rawValue}</p>
                    ) : null}
                    <p className="text-xs text-muted">
                      {detail?.explanation || meta?.shortDescription || meta?.howMeasured || meta?.scaleDirection}
                    </p>
                    {!observed ? (
                      <span className="mt-1 inline-flex">
                        <span className="cs-badge bg-amber-100 text-[10px] text-amber-800">Not observed</span>
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">What this means</p>
            <ul className="space-y-2 text-sm text-foreground">
              {profile.highlights?.slice(0, 3).map((highlight) => (
                <li key={highlight} className="rounded border border-border/50 bg-white/60 px-3 py-2">
                  {highlight}
                </li>
              ))}
              {!profile.highlights?.length ? (
                <li className="rounded border border-border/50 bg-white/60 px-3 py-2 text-muted">
                  Key takeaways will appear here.
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      )}

      {tagList?.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Tags</p>
          <div className="flex flex-wrap gap-2">
            {tagList.slice(0, 6).map((tag) => (
              <Chip key={tag} label={tag} />
            ))}
          </div>
        </div>
      ) : null}

      {insights && insights.length ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            Domain insights
          </p>
          <ul className="list-disc space-y-1 pl-4 text-sm text-foreground/90">
            {insights.slice(0, 3).map((insight) => (
              <li key={insight}>{insight}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {extra}
    </div>
  );
}
