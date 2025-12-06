import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { VideoFingerprintJson } from "../lib/types";

type Props = {
  fingerprint?: VideoFingerprintJson | null;
  comparisonLabel?: string;
  comparisonValues?: VideoFingerprintJson["metaAxes"];
};

type ChartDatum = {
  axis: string;
  value: number;
  comparison?: number;
};

const axisLabels: Record<keyof VideoFingerprintJson["metaAxes"], string> = {
  voiceIntensity: "Voice intensity",
  conceptualDepth: "Conceptual depth",
  narrativeStructureStrength: "Narrative structure",
  visualDynamism: "Visual dynamism",
  productionPolish: "Production polish",
};

const toChartData = (
  meta: VideoFingerprintJson["metaAxes"],
  comparison?: VideoFingerprintJson["metaAxes"],
): ChartDatum[] =>
  Object.entries(meta).map(([key, value]) => ({
    axis: axisLabels[key as keyof typeof axisLabels],
    value,
    comparison: comparison?.[key as keyof typeof meta],
  }));

export function RadarChartOverview({ fingerprint, comparisonValues, comparisonLabel }: Props) {
  if (!fingerprint) {
    return (
      <div className="rounded-md border border-border bg-white/70 p-6 text-sm text-muted">
        No analysis yet. Run an analysis to see your radar.
      </div>
    );
  }

  const data = toChartData(fingerprint.metaAxes, comparisonValues);

  return (
    <div className="h-[360px] w-full rounded-md border border-border bg-white/80 p-4 shadow-sm">
      <ResponsiveContainer>
        <RadarChart data={data}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: "#475569", fontSize: 12 }} />
          <PolarRadiusAxis tick={{ fill: "#94a3b8", fontSize: 10 }} angle={30} domain={[0, 100]} />
          <Radar
            name="You"
            dataKey="value"
            stroke="#0ea5e9"
            fill="#0ea5e9"
            fillOpacity={0.35}
            strokeWidth={2}
          />
          {comparisonValues ? (
            <Radar
              name={comparisonLabel ?? "Reference"}
              dataKey="comparison"
              stroke="#94a3b8"
              fill="#94a3b8"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ) : null}
          <Tooltip
            formatter={(val: number) => `${Math.round(val)} / 100`}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
