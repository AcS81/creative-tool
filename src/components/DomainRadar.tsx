import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DomainProfile } from "../lib/types/fingerprint";
import { resolveAxisMetadata } from "../lib/analysis/axisMetadata";

type Props = {
  profile: DomainProfile;
};

export function DomainRadar({ profile }: Props) {
  const data = profile.scores.map((score) => {
    const meta = resolveAxisMetadata(score.key);
    const detail = profile.axisDetails?.[meta?.id ?? score.key];
    const observed = detail?.observed !== false && detail?.rawValue !== "unobserved";
    return {
      axisId: meta?.id ?? score.key,
      axis: meta?.label ?? score.label ?? score.key,
      value: Math.max(0, Math.min(100, score.value)),
      raw: detail?.rawValue,
      observed,
      description: detail?.explanation || meta?.shortDescription || meta?.howMeasured || "",
      how: meta?.howMeasured,
      scale: meta?.scaleDirection,
    };
  });

  if (!data.length) return null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const item = payload[0]?.payload;
    if (!item) return null;
    return (
      <div className="rounded-md border border-border bg-white px-3 py-2 text-sm shadow-md">
        <p className="font-semibold text-foreground">{item.axis}</p>
        <p className="text-muted">{Math.round(item.value)} / 100</p>
        {item.raw ? <p className="text-xs text-foreground/80">Raw: {item.raw}</p> : null}
        {item.description ? <p className="mt-1 text-xs text-muted">{item.description}</p> : null}
        {!item.observed ? <p className="mt-1 text-xs text-amber-700">Not observed confidently</p> : null}
      </div>
    );
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <RadarChart cx="50%" cy="50%" outerRadius="65%" data={data}>
            <PolarGrid stroke="#CBD5E1" />
            <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "#475569" }} />
            <Radar
              name="Profile"
              dataKey="value"
              stroke="var(--accent, #0f172a)"
              fill="var(--accent, #0f172a)"
              fillOpacity={0.35}
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
            {item.description ? <p className="text-xs text-muted">{item.description}</p> : null}
            {item.raw ? <p className="text-[11px] text-foreground/70">Raw: {item.raw}</p> : null}
            {item.scale ? <p className="text-[11px] text-muted">Scale: {item.scale}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
