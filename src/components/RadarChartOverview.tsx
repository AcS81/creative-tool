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
import { metaAxesMetadata } from "../lib/analysis/axisMetadata";

type Props = {
  fingerprint?: VideoFingerprintJson | null;
  comparisonLabel?: string;
  comparisonValues?: VideoFingerprintJson["metaAxes"];
};

type ChartDatum = {
  axis: string;
  value: number;
  comparison?: number;
  description: string;
};

const toChartData = (
  meta: VideoFingerprintJson["metaAxes"],
  comparison?: VideoFingerprintJson["metaAxes"],
): ChartDatum[] =>
  metaAxesMetadata.map(({ id, label, description }) => ({
    axis: label,
    value: meta[id as keyof typeof meta],
    comparison: comparison?.[id as keyof typeof meta],
    description,
  }));

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const description = item.payload?.description as string | undefined;
  return (
    <div className="rounded-md border border-border bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-muted">{Math.round(item.value)} / 100</p>
      {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
    </div>
  );
}

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
    <div className="w-full space-y-3 rounded-md border border-border bg-white/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-[#2563eb]" />
          You
        </span>
        {comparisonValues ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border border-border bg-gray-200" />
            {comparisonLabel ?? "Reference avg"}
          </span>
        ) : null}
      </div>
      <div className="grid gap-2 text-[12px] text-muted md:grid-cols-5">
        <span>Voice intensity</span>
        <span>Conceptual depth</span>
        <span>Narrative structure</span>
        <span>Visual dynamism</span>
        <span>Production polish</span>
      </div>
      <div className="h-[360px] w-full">
        <ResponsiveContainer>
          <RadarChart data={data}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: "#475569", fontSize: 12 }} />
            <PolarRadiusAxis tick={{ fill: "#94a3b8", fontSize: 10 }} angle={30} domain={[0, 100]} />
            <Radar
              name="You"
              dataKey="value"
              stroke="#2563eb"
              fill="#2563eb"
              fillOpacity={0.28}
              strokeWidth={2}
            />
            {comparisonValues ? (
              <Radar
                name={comparisonLabel ?? "Reference"}
                dataKey="comparison"
                stroke="#94a3b8"
                fill="#94a3b8"
                fillOpacity={0.12}
                strokeWidth={2}
              />
            ) : null}
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
