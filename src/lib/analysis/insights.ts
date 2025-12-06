import type { VideoFingerprintJson } from "../types";

type MetaAxes = VideoFingerprintJson["metaAxes"];

const axisLabels: Record<keyof MetaAxes, string> = {
  voiceIntensity: "Voice intensity",
  conceptualDepth: "Conceptual depth",
  narrativeStructureStrength: "Narrative structure strength",
  visualDynamism: "Visual dynamism",
  productionPolish: "Production polish",
};

const percentile = (value: number, samples: number[]) => {
  if (!samples.length) return 0.5;
  const below = samples.filter((s) => s <= value).length;
  return below / samples.length;
};

const describeDelta = (axis: keyof MetaAxes, pct: number, score: number) => {
  const label = axisLabels[axis];
  if (pct === 50) return `${label}: about typical vs reference creators.`;
  if (pct > 70) return `${label}: higher than ${pct}% of reference creators (standout strength).`;
  if (pct > 50) return `${label}: above ${pct}% of reference creators.`;
  if (pct < 30) return `${label}: lower than ${100 - pct}% of reference creators (unusual softness).`;
  return `${label}: below ${100 - pct}% of reference creators.`;
};

export function generateInsights(userMeta: MetaAxes, references: MetaAxes[]): string[] {
  if (!references.length) return ["Not enough reference data yet."];

  const insights: { axis: keyof MetaAxes; score: number; pct: number }[] = [];

  (Object.keys(userMeta) as Array<keyof MetaAxes>).forEach((axis) => {
    const refSamples = references.map((ref) => ref[axis]);
    const pct = percentile(userMeta[axis], refSamples);
    const distanceFromMid = Math.abs(pct - 0.5);
    insights.push({ axis, score: userMeta[axis], pct, distanceFromMid });
  });

  insights.sort((a, b) => b.distanceFromMid - a.distanceFromMid);
  const top = insights.slice(0, 4);

  return top.map((item) => {
    const pct = Math.round(item.pct * 100);
    return describeDelta(item.axis, pct, item.score);
  });
}
