import { describe, expect, it } from "vitest";
import { computeAverageMetaAxes, distanceOnMetaAxes, findNearestReferences } from "./similarity";
import { buildDefaultAdvancedMetrics } from "./fingerprint/defaults";
import type { VideoFingerprintJson } from "../types";

const fp = (voice: number, key: string): VideoFingerprintJson => ({
  version: "1.3.0",
  createdAt: new Date().toISOString(),
  ...buildDefaultAdvancedMetrics(),
  metaAxes: {
    voiceIntensity: voice,
    conceptualDepth: 60,
    narrativeStructureStrength: 60,
    visualDynamism: 60,
    productionPolish: 60,
  },
  perDomain: {
    voiceProfile: { primaryArchetype: "a", summaryText: "", scores: [{ key: "v", label: "V", value: 50 }] },
    languageProfile: { primaryArchetype: "a", summaryText: "", scores: [{ key: "l", label: "L", value: 50 }] },
    narrativeProfile: { primaryArchetype: "a", summaryText: "", scores: [{ key: "n", label: "N", value: 50 }] },
    visualProfile: { primaryArchetype: "a", summaryText: "", scores: [{ key: "vi", label: "Vi", value: 50 }] },
    editingProfile: { primaryArchetype: "a", summaryText: "", scores: [{ key: "e", label: "E", value: 50 }] },
    soundProfile: { primaryArchetype: "a", summaryText: "", scores: [{ key: "s", label: "S", value: 50 }] },
  },
});

describe("similarity helpers", () => {
  it("computes Euclidean distance on meta axes", () => {
    const a = fp(50, "a").metaAxes;
    const b = fp(60, "b").metaAxes;
    const dist = distanceOnMetaAxes(a, b);
    expect(dist).toBeGreaterThan(0);
  });

  it("computes average meta axes", () => {
    const avg = computeAverageMetaAxes([fp(40, "a"), fp(60, "b")]);
    expect(avg?.voiceIntensity).toBe(50);
  });

  it("finds nearest references", () => {
    const target = fp(55, "t");
    const refs = [
      { creatorId: "1", displayName: "A", fingerprint: fp(54, "a") },
      { creatorId: "2", displayName: "B", fingerprint: fp(80, "b") },
    ];
    const nearest = findNearestReferences(target, refs, 1);
    expect(nearest[0]?.creatorId).toBe("1");
  });

  it("lightly weights second-order alignment when available", () => {
    const base = fp(60, "base");
    base.secondOrder.alignmentScore.score = 80;
    const aligned = fp(60, "aligned");
    aligned.secondOrder.alignmentScore.score = 90;
    const misaligned = fp(60, "misaligned");
    misaligned.secondOrder.alignmentScore.score = 10;

    const nearest = findNearestReferences(base, [
      { creatorId: "aligned", displayName: "Aligned Ref", fingerprint: aligned },
      { creatorId: "misaligned", displayName: "Misaligned Ref", fingerprint: misaligned },
    ]);

    expect(nearest[0]?.creatorId).toBe("aligned");
  });
});
