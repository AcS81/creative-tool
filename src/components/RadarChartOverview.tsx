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
  observedAxes?: Record<string, boolean>;
};

type ChartDatum = {
  axis: string;
  value: number;
  comparison?: number;
  description: string;
  observed?: boolean;
};

const toChartData = (
  meta: VideoFingerprintJson["metaAxes"],
  comparison?: VideoFingerprintJson["metaAxes"],
  observedAxes?: Record<string, boolean>,
): ChartDatum[] =>
  metaAxesMetadata.map(({ id, label, shortDescription }) => ({
    axis: label,
    value: meta[id as keyof typeof meta],
    comparison: comparison?.[id as keyof typeof meta],
    description: shortDescription,
    observed: observedAxes?.[id] !== false,
  }));

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const description = item.payload?.description as string | undefined;
  const observed = item.payload?.observed !== false;
  return (
    <div className="rounded-md border border-border bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-muted">{Math.round(item.value)} / 100</p>
      {!observed && <p className="mt-1 text-xs font-semibold text-amber-600">Not observed</p>}
      {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
    </div>
  );
}

export function RadarChartOverview({ fingerprint, comparisonValues, comparisonLabel, observedAxes }: Props) {
  if (!fingerprint) {
    return (
      <div className="rounded-md border border-border bg-white/70 p-6 text-sm text-muted">
        No analysis yet. Run an analysis to see your radar.
      </div>
    );
  }

  const data = toChartData(fingerprint.metaAxes, comparisonValues, observedAxes);
  const observedCount = data.filter((d) => d.observed !== false).length;
  const totalCount = data.length;
  const hasPartialData = observedCount > 0 && observedCount < totalCount;
  const allUnobserved = observedCount === 0;

  const summary = data.map((item) => `${item.axis}: ${Math.round(item.value)}/100`).join("; ");
  const comparisonSummary = comparisonValues
    ? metaAxesMetadata
        .map((axis) => `${axis.label} reference: ${Math.round(comparisonValues[axis.id as keyof typeof comparisonValues])}/100`)
        .join("; ")
    : undefined;

  // Show placeholder if all unobserved
  if (allUnobserved) {
    return (
      <div className="w-full space-y-3 rounded-md border-2 border-amber-200 bg-amber-50 p-6 text-sm">
        <p className="font-semibold text-amber-900">Meta-axes not available</p>
        <p className="text-amber-700">
          Core metrics were not fully observed for this video, so meta-axis scores could not be computed.
        </p>
      </div>
    );
  }

  return (
    <div
      className="w-full space-y-3 rounded-md border border-border bg-white/80 p-4 shadow-sm"
      role="img"
      aria-label="Meta-axis radar overview"
      aria-describedby="meta-radar-summary"
    >
      <p id="meta-radar-summary" className="sr-only">
        {summary}
        {comparisonSummary ? `; ${comparisonSummary}` : ""}
      </p>
      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-[#2563eb]" />
          You {hasPartialData && <span className="text-emerald-600">({observedCount}/{totalCount} observed)</span>}
        </span>
        {comparisonValues ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border border-border bg-gray-200" />
            {comparisonLabel ?? "Reference avg"}
          </span>
        ) : null}
        {hasPartialData && (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm border-2 border-dashed border-gray-400 bg-gray-100" />
            Not observed
          </span>
        )}
      </div>
      {hasPartialData && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
          <p className="font-semibold text-amber-900">Partial data</p>
          <p>Some meta-axes couldn't be computed from the available core metrics.</p>
        </div>
      )}
      <div className="grid gap-2 text-[12px] text-muted md:grid-cols-5">
        {metaAxesMetadata.map((axis) => (
          <span key={axis.id}>{axis.label}</span>
        ))}
      </div>
      <div className="h-[360px] w-full">
        <ResponsiveContainer aria-hidden="true">
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
