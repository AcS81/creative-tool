import type { VideoFingerprintJson } from "../types";

type MetaAxes = VideoFingerprintJson["metaAxes"];

const axisLabels: Record<keyof MetaAxes, string> = {
  voiceIntensity: "Voice intensity",
  conceptualDepth: "Conceptual depth",
  narrativeStructureStrength: "Narrative structure strength",
  visualDynamism: "Visual dynamism",
  productionPolish: "Production polish",
};

export type Insight = {
  category: "unusualness" | "strength" | "growth";
  axis: keyof MetaAxes;
  text: string;
};

const percentile = (value: number, samples: number[]) => {
  if (!samples.length) return 0.5;
  const below = samples.filter((s) => s <= value).length;
  return below / samples.length;
};

const describeUnusual = (axis: keyof MetaAxes, pct: number) => {
  const label = axisLabels[axis];
  if (pct > 0.8) return `${label} sits in the top ${Math.round(pct * 100)}% of reference videos.`;
  if (pct < 0.2)
    return `${label} is unusually low vs reference videos (bottom ${Math.round((1 - pct) * 100)}%).`;
  return null;
};

const describeStrength = (axis: keyof MetaAxes, pct: number) => {
  const label = axisLabels[axis];
  if (pct > 0.65) return `${label} is a clear strength compared to most reference videos.`;
  return null;
};

const describeGrowth = (axis: keyof MetaAxes, pct: number) => {
  const label = axisLabels[axis];
  if (pct < 0.35) return `${label} is an area to raise; most reference videos sit higher here.`;
  return null;
};

export function generateInsights(userMeta: MetaAxes, references: MetaAxes[]) {
  if (!references.length) {
    return {
      unusualnessInsights: ["Not enough reference data yet."],
      strengthInsights: [],
      growthInsights: [],
      bullets: ["Not enough reference data yet."],
    };
  }

  const insights: Insight[] = [];

  (Object.keys(userMeta) as Array<keyof MetaAxes>).forEach((axis) => {
    const refSamples = references.map((ref) => ref[axis]);
    const pct = percentile(userMeta[axis], refSamples);
    const unusual = describeUnusual(axis, pct);
    const strength = describeStrength(axis, pct);
    const growth = describeGrowth(axis, pct);

    if (unusual) insights.push({ category: "unusualness", axis, text: unusual });
    if (strength) insights.push({ category: "strength", axis, text: strength });
    if (growth) insights.push({ category: "growth", axis, text: growth });
  });

  const unusualnessInsights = insights
    .filter((i) => i.category === "unusualness")
    .slice(0, 4)
    .map((i) => i.text);
  const strengthInsights = insights
    .filter((i) => i.category === "strength")
    .slice(0, 3)
    .map((i) => i.text);
  const growthInsights = insights
    .filter((i) => i.category === "growth")
    .slice(0, 3)
    .map((i) => i.text);

  const bullets = [...unusualnessInsights, ...strengthInsights, ...growthInsights].slice(0, 6);

  return {
    unusualnessInsights,
    strengthInsights,
    growthInsights,
    bullets,
  };
}
