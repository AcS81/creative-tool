import { validateFingerprint } from "../schemas/fingerprint";
import type { AnalyzeVideoInput, AnalyzeVideoResult } from "./types";
import type { DomainScore, DomainProfile, VideoFingerprintJson } from "../types";

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

const score = (key: string, label: string, value: number): DomainScore => ({
  key,
  label,
  value,
});

const buildDomain = (label: string, base: number): DomainProfile => ({
  primaryArchetype: `${label} Archetype`,
  secondaryArchetype: `Alt ${label} Archetype`,
  summaryText: `${label} summary based on mock analysis.`,
  scores: [score(`${label.toLowerCase()}-axis`, `${label} Axis`, clamp(base))],
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
    version: "1.1.0",
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
    supporting: {
      transcriptSegments: [
        { startSeconds: 0, endSeconds: 30, text: "Intro segment" },
        { startSeconds: 30, endSeconds: 60, text: "Body segment" },
      ],
      sceneSegments: [
        { startSeconds: 0, endSeconds: 30, label: "Intro", shortSummary: "Opening remarks" },
      ],
      beats: [
        { startSeconds: 5, endSeconds: 25, label: "Hook", devices: ["contrast"] },
      ],
    },
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
