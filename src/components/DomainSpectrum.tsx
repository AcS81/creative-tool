import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DomainKey } from "../lib/archetypes/descriptions";
import type { DomainProfile } from "../lib/types";
import { buildSpectrumData } from "../lib/analysis/spectrum";

type Props = {
  domain: DomainKey;
  profile: DomainProfile;
};

export function DomainSpectrum({ domain, profile }: Props) {
  const data = buildSpectrumData(domain, profile);
  const hasObserved = data.some((d) => d.observed);

  if (!data.length || !hasObserved) {
    return (
      <div className="rounded-md border border-dashed border-border/70 bg-white/60 px-4 py-6 text-sm text-muted">
        Spectrum view not available yet for this domain.
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const item = payload[0]?.payload;
    if (!item) return null;
    return (
      <div className="rounded-md border border-border bg-white px-3 py-2 text-sm shadow-md">
        <p className="font-semibold text-foreground">{item.axis}</p>
        <p className="text-muted">{Math.round(item.value)} / 100</p>
        {item.labels ? (
          <p className="text-[11px] text-foreground/70">
            {item.labels.low}
            {item.labels.mid ? ` • ${item.labels.mid}` : ""} • {item.labels.high}
          </p>
        ) : null}
        {item.description ? <p className="mt-1 text-xs text-muted">{item.description}</p> : null}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Spectrum view</p>
        <p className="text-[11px] text-muted">Midpoint can be the sweet spot</p>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <RadarChart cx="50%" cy="50%" outerRadius="65%" data={data}>
            <PolarGrid stroke="#CBD5E1" />
            <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "#475569" }} />
            <Radar
              name="Spectrum"
              dataKey="value"
              stroke="var(--accent, #0f172a)"
              fill="var(--accent, #0f172a)"
              fillOpacity={0.28}
            />
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-2 text-xs text-muted md:grid-cols-2">
        {data.map((item) => (
          <div key={item.axisId} className="rounded border border-border/60 bg-surface-strong px-3 py-2">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span>{item.axis}</span>
              <span>{Math.round(item.value)}</span>
            </div>
            {item.labels ? (
              <p className="text-[11px] text-muted">
                {item.labels.low}
                {item.labels.mid ? ` • ${item.labels.mid}` : ""} • {item.labels.high}
              </p>
            ) : null}
            {item.description ? <p className="text-[11px] text-muted">{item.description}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

