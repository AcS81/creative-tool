import { validateFingerprint } from "../schemas/fingerprint";
import type { AnalyzeVideoInput, AnalyzeVideoResult } from "./types";
import type { AxisScore, DomainProfile, VideoFingerprintJson } from "../types";

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const hashStringToNumber = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const deriveScore = (seed: number, salt: number) =>
  clamp(((seed + salt * 9973) % 101) + (salt % 7) - 3);

const axis = (key: string, label: string, value: number): AxisScore => ({
  key,
  label,
  value,
});

const buildDomain = (label: string, base: number): DomainProfile => ({
  archetype: `${label} Archetype`,
  summary: `${label} summary based on mock analysis.`,
  description: `${label} description placeholder.`,
  axes: [axis(`${label.toLowerCase()}-axis`, `${label} Axis`, clamp(base))],
  highlights: [`Mock highlight for ${label.toLowerCase()}`],
});

const archetypeForMeta = (meta: VideoFingerprintJson["metaAxes"]) => {
  if (meta.voiceIntensity > 70 && meta.visualDynamism > 65) return "Hyperactive Commentator";
  if (meta.conceptualDepth > 70 && meta.narrativeStructureStrength > 65) return "Reflective Analyst";
  if (meta.productionPolish > 75) return "Polished Host";
  return "Versatile Creator";
};

export function mockAnalyzeVideo(input: AnalyzeVideoInput): AnalyzeVideoResult {
  const seed = hashStringToNumber(input.videoId);

  const fingerprint: VideoFingerprintJson = {
    version: "1.0.0",
    createdAt: new Date().toISOString(),
    metaAxes: {
      voiceIntensity: deriveScore(seed, 1),
      conceptualDepth: deriveScore(seed, 2),
      narrativeStructureStrength: deriveScore(seed, 3),
      visualDynamism: deriveScore(seed, 4),
      productionPolish: deriveScore(seed, 5),
    },
    perDomain: {
      voiceProfile: buildDomain("Voice", deriveScore(seed, 6)),
      languageProfile: buildDomain("Language", deriveScore(seed, 7)),
      narrativeProfile: buildDomain("Narrative", deriveScore(seed, 8)),
      visualProfile: buildDomain("Visual", deriveScore(seed, 9)),
      editingProfile: buildDomain("Editing", deriveScore(seed, 10)),
      soundProfile: buildDomain("Sound", deriveScore(seed, 11)),
    },
    overallArchetype: "",
  };

  const overallArchetype = archetypeForMeta(fingerprint.metaAxes);
  const validatedFingerprint = validateFingerprint({
    ...fingerprint,
    overallArchetype,
  });

  return {
    fingerprint: validatedFingerprint,
    overallArchetype,
    diagnostics: {
      source: "mock",
      hashSeed: seed,
    },
  };
}
