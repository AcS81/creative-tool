import type { VideoFingerprintJson, FingerprintPerDomain } from "../types";

type MetaAxes = VideoFingerprintJson["metaAxes"];

export const axisLabels: Record<keyof MetaAxes, string> = {
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

type ObservationContext = {
  fingerprint?: VideoFingerprintJson;
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

const domainsByMetaAxis: Record<keyof MetaAxes, Array<keyof FingerprintPerDomain>> = {
  voiceIntensity: ["voiceProfile"],
  conceptualDepth: ["languageProfile"],
  narrativeStructureStrength: ["narrativeProfile"],
  visualDynamism: ["visualProfile", "editingProfile"],
  productionPolish: ["editingProfile", "soundProfile"],
};

const isAxisObserved = (axis: keyof MetaAxes, fingerprint?: VideoFingerprintJson) => {
  if (!fingerprint) return true;
  const domains = domainsByMetaAxis[axis] ?? [];
  if (domains.length === 0) return true;

  const domainScores = domains.map((d) => fingerprint.perDomain[d]?.scores ?? []);
  const allScores = domainScores.flat();
  if (allScores.length === 0) return false;

  const hasNonZero = allScores.some((s) => s.value > 0);
  const hasObservedDetail =
    fingerprint.supporting?.axisDetails &&
    Object.values(fingerprint.supporting.axisDetails).some((detail) => detail.observed !== false);

  return hasNonZero || hasObservedDetail;
};

const advancedInsights = (fingerprint?: VideoFingerprintJson): string[] => {
  if (!fingerprint) return [];
  const bullets: string[] = [];

  const loadHighlights = fingerprint.cognitiveLoad?.loadHighlights;
  const topLoadSpan =
    loadHighlights?.spans && loadHighlights.spans.length > 0
      ? [...loadHighlights.spans].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0]
      : null;
  if (topLoadSpan && (topLoadSpan.value ?? 0) > 60 && topLoadSpan.value !== 0) {
    const when = Math.round(topLoadSpan.startSeconds ?? 0);
    const label = topLoadSpan.label ? ` (${topLoadSpan.label})` : "";
    bullets.push(`Cognitive load spikes around ${when}s${label}; consider easing pacing there.`);
  }

  const alignmentScore = fingerprint.secondOrder?.alignmentScore?.score;
  if (typeof alignmentScore === "number") {
    if (alignmentScore < 35) {
      bullets.push("Low cross-modal alignment: emphasis, edits, and beats often miss each other.");
    } else if (alignmentScore > 70) {
      bullets.push("Strong cross-modal alignment: audio, visuals, and beats reinforce each other.");
    }
  }

  const balanceScore = fingerprint.secondOrder?.balanceScore?.score;
  if (typeof balanceScore === "number") {
    if (balanceScore < 40) {
      bullets.push("Modalities lean on one channel; tighten complementarity to reduce over-reliance.");
    } else if (balanceScore > 70) {
      bullets.push("Strong modality balance: audio, visuals, and text share the load well.");
    }
  }

  const paceVariance = fingerprint.prosodyArc?.paceVariabilityPct?.score;
  const editAlignment = fingerprint.visualEditAlignment?.beatsVsEditsAlignment?.score;
  if (typeof paceVariance === "number" && typeof editAlignment === "number") {
    if (editAlignment > 65 && paceVariance > 55) {
      bullets.push("Audio cadence and edits sync tightly; pacing + cuts reinforce your beats.");
    } else if (editAlignment < 40 && paceVariance > 55) {
      bullets.push("Rapid pacing with loose edit alignment—consider anchoring cuts to key beats.");
    }
  }

  return bullets;
};

export function generateInsights(
  userMeta: MetaAxes,
  references: MetaAxes[],
  options: ObservationContext = {},
) {
  const refs = (references ?? []).filter(
    (ref): ref is MetaAxes => !!ref && typeof ref.voiceIntensity === "number",
  );

  if (!refs.length) {
    return {
      unusualnessInsights: ["Not enough reference data yet."],
      strengthInsights: [],
      growthInsights: [],
      bullets: ["Not enough reference data yet."],
    };
  }

  const insights: Insight[] = [];

  (Object.keys(userMeta) as Array<keyof MetaAxes>).forEach((axis) => {
    if (!isAxisObserved(axis, options.fingerprint)) return;
    const refSamples = refs.map((ref) => ref[axis]);
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

  const advanced = advancedInsights(options.fingerprint);
  const bullets = [...advanced, ...unusualnessInsights, ...strengthInsights, ...growthInsights].slice(0, 8);

  return {
    unusualnessInsights,
    strengthInsights,
    growthInsights,
    bullets,
  };
}
