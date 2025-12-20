import type { VideoFingerprintJson } from "../lib/types";

type MetricCardProps = {
  title: string;
  value?: string | number | null;
  detail?: string;
  fallback?: string;
};

const MetricCard = ({ title, value, detail, fallback = "Not observed" }: MetricCardProps) => (
  <div className="flex flex-col gap-1 rounded-md border border-border bg-surface p-3 shadow-sm">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</p>
    <p className="text-base font-semibold text-foreground">
      {value === undefined || value === null || value === "" ? fallback : value}
    </p>
    {detail ? <p className="text-[12px] text-muted">{detail}</p> : null}
  </div>
);

const safeValue = (raw?: string | number | null) => {
  if (raw === undefined || raw === null) return undefined;
  const val = typeof raw === "string" ? raw.trim() : `${raw}`;
  return val.toLowerCase() === "unobserved" || val === "" ? undefined : val;
};

const formatProportions = (proportions?: Record<string, number>) => {
  if (!proportions) return undefined;
  return Object.entries(proportions)
    .map(([k, v]) => `${k}: ${(v * 100).toFixed(0)}%`)
    .join(" • ");
};

const formatCutRefinement = (items?: Record<string, unknown>[] | undefined, fallback?: string) => {
  const first = items?.[0] as { medianShotSeconds?: number; variance?: number; beatCouplingDelta?: number } | undefined;
  if (!first) return fallback;
  const parts = [
    first.medianShotSeconds ? `median ${first.medianShotSeconds.toFixed(1)}s` : null,
    first.variance ? `var ${first.variance.toFixed(1)}` : null,
    first.beatCouplingDelta ? `beat Δ ${first.beatCouplingDelta.toFixed(1)}s` : null,
  ].filter(Boolean);
  return parts.join(" • ") || fallback;
};

const metricObserved = (value?: string | number | null) => safeValue(value) !== undefined;

export const AdvancedSignalsStrip = ({ fingerprint }: { fingerprint?: VideoFingerprintJson | null }) => {
  const adv = fingerprint ?? undefined;
  const prosody = adv?.prosodyArc;
  const language = adv?.languageTexture;
  const visual = adv?.visualEditAlignment;
  const balance = adv?.modalityBalance;
  const secondOrder = adv?.secondOrder;

  const energyDrift = prosody?.energyDriftDbPerMin;
  const visualEntropy = visual?.visualEntropy;
  const cutRefinement = visual?.cutRateRefinement;
  const redundancy = balance?.redundancyVsComplementarity;
  const audienceAddress = language?.audienceAddressFrequency;

  const secondOrderEntries: Array<{ key: string; label: string; value?: string | number | null; observed?: boolean }> = [
    { key: "alignmentScore", label: "Alignment", value: secondOrder?.alignmentScore.value, observed: secondOrder?.alignmentScore.observed },
    { key: "driftScore", label: "Drift", value: secondOrder?.driftScore.value, observed: secondOrder?.driftScore.observed },
    { key: "decayScore", label: "Decay", value: secondOrder?.decayScore.value, observed: secondOrder?.decayScore.observed },
    { key: "balanceScore", label: "Balance", value: secondOrder?.balanceScore.value, observed: secondOrder?.balanceScore.observed },
    { key: "timingScore", label: "Timing", value: secondOrder?.timingScore.value, observed: secondOrder?.timingScore.observed },
  ];

  return (
    <div className="space-y-3 rounded-md border border-border bg-surface p-4 shadow-sm" id="advanced-signals">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted">Advanced signals</p>
        <a
          className="text-xs font-semibold text-foreground underline"
          href="/docs/axes_and_domains.md"
          target="_blank"
          rel="noreferrer"
        >
          Glossary
        </a>
      </div>
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          title="Energy drift"
          value={safeValue(energyDrift?.value)}
          detail={
            energyDrift?.timeline?.length
              ? `Timeline points: ${energyDrift.timeline.length}`
              : energyDrift?.trend !== undefined
                ? `Trend: ${energyDrift.trend.toFixed(2)}`
                : undefined
          }
        />
        <MetricCard
          title="Visual entropy"
          value={safeValue(visualEntropy?.value)}
          detail={visualEntropy?.timeline?.length ? `Timeline points: ${visualEntropy.timeline.length}` : undefined}
        />
        <MetricCard
          title="Cut-rate refinement"
          value={safeValue(cutRefinement?.value)}
          detail={formatCutRefinement(cutRefinement?.items, cutRefinement?.timeline ? undefined : "—")}
        />
        <MetricCard
          title="Redundancy vs complementarity"
          value={safeValue(redundancy?.value)}
          detail={formatProportions(redundancy?.proportions)}
        />
        <MetricCard
          title="Audience address"
          value={safeValue(audienceAddress?.value)}
          detail={
            audienceAddress?.counts
              ? `Direct ${audienceAddress.counts.direct ?? 0} / Rhetorical ${audienceAddress.counts.rhetorical ?? 0}`
              : undefined
          }
        />
      </div>

      <div className="rounded-md border border-border/80 bg-surface-strong p-3" id="second-order-summary">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Second-order summary</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {secondOrderEntries.map((entry) => (
            <div
              key={entry.key}
              className={`rounded-md border p-2 ${
                entry.observed === false ? "border-dashed border-border text-muted" : "border-border bg-white/60"
              }`}
            >
              <p className="text-[11px] font-semibold text-muted">{entry.label}</p>
              <p className="text-base font-semibold text-foreground">
                {entry.value ?? (entry.observed === false ? "Not observed" : "—")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
