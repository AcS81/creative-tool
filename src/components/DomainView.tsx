import type { ReactNode } from "react";
import type { DomainProfile, ScoredMetric } from "../lib/types";
import { Chip } from "./Chip";
import { DomainScoreBars } from "./DomainScoreBars";
import { describeArchetype, type DomainKey } from "../lib/archetypes/descriptions";
import { resolveAxisMetadata } from "../lib/analysis/axisMetadata";
import { CoverageIndicator } from "./MetricValue";

type AdvancedDetailItem = {
  label: string;
  metric?: ScoredMetric;
  detail?: string;
};

type AdvancedDetailSection = {
  title: string;
  items: AdvancedDetailItem[];
};

type Props = {
  name: string;
  domain: DomainKey;
  profile: DomainProfile;
  visual?: ReactNode;
  tags?: string[];
  insights?: string[];
  extra?: ReactNode;
  detailOverride?: ReactNode;
  advancedSections?: AdvancedDetailSection[];
};

const formatMetricValue = (metric?: ScoredMetric) => {
  if (!metric) return { observed: false, text: "Not observed" };
  const rawValue =
    typeof metric.value === "string"
      ? metric.value.trim()
      : typeof metric.value === "number"
        ? `${metric.value}`
        : "";
  const hasValue = rawValue !== "" && rawValue.toLowerCase() !== "unobserved";
  const observedFlag = metric.observed === true;
  if (metric.observed === false) return { observed: false, text: "Not observed" };
  if (hasValue) return { observed: true, text: rawValue };
  if (observedFlag) return { observed: true, text: `${Math.round(metric.score)}` };
  if (metric.score > 0) return { observed: true, text: `${Math.round(metric.score)}` };
  return { observed: false, text: "Not observed" };
};

const buildMetricDetail = (metric?: ScoredMetric) => {
  if (!metric) return undefined;
  const parts: string[] = [];
  if (metric.timeline?.length) parts.push(`timeline ${metric.timeline.length}`);
  if (metric.spans?.length) parts.push(`spans ${metric.spans.length}`);
  if (metric.segments?.length) parts.push(`segments ${metric.segments.length}`);
  if (metric.items?.length) parts.push(`items ${metric.items.length}`);
  if (metric.counts) parts.push(`counts ${Object.keys(metric.counts).length}`);
  if (metric.proportions) parts.push(`proportions ${Object.keys(metric.proportions).length}`);
  return parts.length > 0 ? parts.slice(0, 2).join(" • ") : undefined;
};

export function DomainView({
  name,
  domain,
  profile,
  visual,
  tags,
  insights,
  extra,
  detailOverride,
  advancedSections,
}: Props) {
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
  const advancedItems = advancedSections?.flatMap((section) => section.items) ?? [];
  const advancedObserved = advancedItems.filter((item) => formatMetricValue(item.metric).observed).length;
  const advancedTotal = advancedItems.length;
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

      {advancedSections?.length ? (
        <details className="rounded-lg border border-border/60 bg-surface-strong p-4 shadow-sm">
          <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-semibold text-foreground">
            <span>Advanced details</span>
            <span className="text-[11px] font-semibold text-muted">
              {advancedObserved}/{advancedTotal} observed
            </span>
          </summary>
          <div className="mt-3 space-y-4">
            {advancedSections.map((section) => (
              <div key={section.title} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  {section.title}
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {section.items.map((item) => {
                    const display = formatMetricValue(item.metric);
                    const detail = item.detail ?? buildMetricDetail(item.metric);
                    return (
                      <div
                        key={item.label}
                        className="rounded border border-border/50 bg-white/60 px-3 py-2 text-xs"
                      >
                        <p className="font-semibold text-muted">{item.label}</p>
                        {display.observed ? (
                          <p className="font-semibold text-foreground">{display.text}</p>
                        ) : (
                          <span className="cs-badge bg-amber-100 text-[10px] text-amber-800">
                            {display.text}
                          </span>
                        )}
                        {detail ? <p className="text-[11px] text-muted">{detail}</p> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}

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
