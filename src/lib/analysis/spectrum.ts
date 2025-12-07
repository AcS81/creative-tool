import type { DomainKey } from "../archetypes/descriptions";
import type { DomainProfile } from "../types";
import { chartAxesByDomain, resolveAxisMetadata } from "./axisMetadata";

export type SpectrumDatum = {
  axisId: string;
  axis: string;
  value: number;
  description?: string;
  labels?: { low: string; mid?: string; high: string };
  observed: boolean;
  sources?: string[];
};

const clamp = (val: number) => Math.max(0, Math.min(100, val));

const normalizeKey = (key: string) => resolveAxisMetadata(key)?.id ?? key;

const toCenteredUnit = (value: number) => (value - 50) / 50; // maps 0..100 => -1..1

export const buildSpectrumData = (domain: DomainKey, profile: DomainProfile): SpectrumDatum[] => {
  const spec = chartAxesByDomain[domain];
  if (!spec) return [];

  const scoreIndex = new Map<string, number>();
  profile.scores.forEach((score) => {
    const id = normalizeKey(score.key);
    scoreIndex.set(id, score.value);
    // also index by metric part (e.g., speaking_rate)
    const parts = id.split(".");
    if (parts.length > 1) {
      scoreIndex.set(parts[1], score.value);
    }
  });

  return spec.spectrum.map((axis) => {
    const derivedKeys = axis.derivedFrom ?? [];
    const values = derivedKeys
      .map((k) => scoreIndex.get(normalizeKey(k)))
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

    const observed = values.length > 0;

    // Opposing ends: weights push left/right around midpoint (50).
    const weights = axis.spectrumWeights ?? {};
    const hasWeights = Object.keys(weights).length > 0;
    let normalized = 50;

    if (hasWeights) {
      let weighted = 0;
      let weightSum = 0;
      derivedKeys.forEach((key) => {
        const w = weights[normalizeKey(key)] ?? weights[key];
        const v = scoreIndex.get(normalizeKey(key));
        if (!w || v === undefined) return;
        weighted += toCenteredUnit(v) * w;
        weightSum += Math.abs(w);
      });
      const centered = weightSum ? Math.max(-1, Math.min(1, weighted / weightSum)) : 0;
      normalized = 50 + centered * 50;
    } else {
      // Fallback: simple average keeps current behavior when no weights provided.
      const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      normalized = average;
    }

    return {
      axisId: axis.id,
      axis: axis.label,
      value: clamp(normalized),
      description: axis.shortDescription,
      labels: axis.spectrumLabels,
      observed,
      sources: derivedKeys,
    };
  });
};

