import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import type { DomainProfile } from "../lib/types/fingerprint";
import { domainMetricMetadata, getAxisLabel } from "../lib/analysis/axisMetadata";

type Props = {
  profile: DomainProfile;
};

export function DomainRadar({ profile }: Props) {
  const mappedDomain =
    Object.entries(domainMetricMetadata).find(([, metrics]) =>
      profile.scores.some((score) => metrics[score.key]),
    )?.[0] || undefined;

  const data = profile.scores.map((score) => ({
    axis: getAxisLabel(score.key, mappedDomain),
    value: Math.max(0, Math.min(100, score.value)),
  }));

  if (!data.length) return null;

  return (
    <div className="mt-4 h-64 w-full">
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
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
