import { describe, expect, it } from "vitest";
import { generateInsights } from "./insights";

const sampleMeta = {
  voiceIntensity: 60,
  conceptualDepth: 55,
  narrativeStructureStrength: 50,
  visualDynamism: 45,
  productionPolish: 65,
};

const refs = [
  { ...sampleMeta, voiceIntensity: 40 },
  { ...sampleMeta, voiceIntensity: 50 },
  { ...sampleMeta, voiceIntensity: 70 },
  { ...sampleMeta, voiceIntensity: 80 },
];

describe("generateInsights", () => {
  it("returns fallback when no references available", () => {
    expect(generateInsights(sampleMeta, [])).toEqual(["Not enough reference data yet."]);
  });

  it("produces ranked insights with readable text", () => {
    const result = generateInsights(sampleMeta, refs);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toMatch(/reference creators/);
  });
});
