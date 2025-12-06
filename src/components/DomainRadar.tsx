import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import type { DomainProfile } from "../lib/types/fingerprint";

type Props = {
  profile: DomainProfile;
};

export function DomainRadar({ profile }: Props) {
  const base = profile.scores.slice(0, 8).map((score) => ({
    axis: score.label,
    value: Math.max(0, Math.min(100, score.value)),
  }));

  const targetAxes = 5;
  const average =
    base.length > 0 ? base.reduce((sum, s) => sum + s.value, 0) / base.length : 50;
  const data = [...base];
  while (data.length < targetAxes) {
    const idx = data.length + 1;
    data.push({ axis: `Axis ${idx}`, value: average });
  }

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
