import type { ReactNode } from "react";
import type { DomainProfile } from "../lib/types";
import { Chip } from "./Chip";
import { DomainScoreBars } from "./DomainScoreBars";

type Props = {
  name: string;
  profile: DomainProfile;
  visual?: ReactNode;
  tags?: string[];
  insights?: string[];
  extra?: ReactNode;
};

export function DomainView({ name, profile, visual, tags, insights, extra }: Props) {
  const tagList = tags && tags.length > 0 ? tags : profile.highlights ?? [];
  return (
    <div className="cs-card p-6 space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="cs-kicker text-[11px]">{name}</p>
          <p className="text-xl font-semibold text-foreground">{profile.primaryArchetype}</p>
          {profile.secondaryArchetype ? (
            <p className="text-sm text-muted">Secondary: {profile.secondaryArchetype}</p>
          ) : null}
          <p className="mt-2 text-sm text-muted">{profile.summaryText}</p>
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
