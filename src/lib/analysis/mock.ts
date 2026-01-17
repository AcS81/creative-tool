import { validateFingerprint } from "../schemas/fingerprint";
import type { AnalyzeVideoInput, AnalyzeVideoResult } from "./types";
import type { DomainScore, DomainProfile, VideoFingerprintJson } from "../types";
import type { DomainKey } from "../archetypes/descriptions";
import { getAxesForDomain } from "./axisMetadata";
import { buildDefaultAdvancedMetrics } from "./fingerprint/defaults";
import { buildMockAdvancedMetrics, hashStringToNumber } from "./fingerprint/mockAdvancedMetrics";
import { buildFallbackSkeleton } from "./structurePass";

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const deriveScore = (seed: number, salt: number) =>
  clamp(((seed + salt * 9973) % 101) + (salt % 7) - 3);

const score = (key: string, label: string, value: number): DomainScore => ({
  key,
  label,
  value,
});

const buildDomain = (domain: DomainKey, base: number): DomainProfile => {
  const label = domain.charAt(0).toUpperCase() + domain.slice(1);
  const axes = getAxesForDomain(domain).slice(0, 3);
  const scores =
    axes.length > 0
      ? axes.map((axis, idx) => score(axis.id, axis.label, clamp(base + idx * 4)))
      : [score(`${domain}-axis`, `${label} Axis`, clamp(base))];

  return {
    primaryArchetype: `${label} Archetype`,
    secondaryArchetype: `Alt ${label} Archetype`,
    summaryText: `${label} summary based on mock analysis.`,
    scores,
    highlights: [`Mock highlight for ${domain}`],
  };
};

const archetypeForMeta = (meta: VideoFingerprintJson["metaAxes"]) => {
  if (meta.voiceIntensity > 70 && meta.visualDynamism > 65) return "Hyperactive Commentator";
  if (meta.conceptualDepth > 70 && meta.narrativeStructureStrength > 65) return "Reflective Analyst";
  if (meta.productionPolish > 75) return "Polished Host";
  return "Versatile Creator";
};

export function mockAnalyzeVideo(input: AnalyzeVideoInput): AnalyzeVideoResult {
  const seed = hashStringToNumber(input.videoId);
  const advancedMetrics = buildMockAdvancedMetrics(seed);
  const skeleton = buildFallbackSkeleton({
    durationSeconds: input.durationSeconds,
  });

  const fingerprint: VideoFingerprintJson = {
    version: "1.3.0",
    createdAt: new Date().toISOString(),
    ...buildDefaultAdvancedMetrics(),
    metaAxes: {
      voiceIntensity: deriveScore(seed, 1),
      conceptualDepth: deriveScore(seed, 2),
      narrativeStructureStrength: deriveScore(seed, 3),
      visualDynamism: deriveScore(seed, 4),
      productionPolish: deriveScore(seed, 5),
    },
    perDomain: {
      voiceProfile: buildDomain("voice", deriveScore(seed, 6)),
      languageProfile: buildDomain("language", deriveScore(seed, 7)),
      narrativeProfile: buildDomain("narrative", deriveScore(seed, 8)),
      visualProfile: buildDomain("visual", deriveScore(seed, 9)),
      editingProfile: buildDomain("editing", deriveScore(seed, 10)),
      soundProfile: buildDomain("sound", deriveScore(seed, 11)),
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
    ...advancedMetrics,
  };

  const overallArchetype = archetypeForMeta(fingerprint.metaAxes);
  const validatedFingerprint = validateFingerprint({
    ...fingerprint,
    overallArchetype,
  });

  return {
    fingerprint: validatedFingerprint,
    skeleton,
    overallArchetype,
    diagnostics: {
      source: "mock",
      hashSeed: seed,
      analysisPath: "mock",
      analysisVersion: "v2",
      structurePass: {
        success: true,
        durationMs: 0,
        tokensUsed: 0,
        costUsd: 0,
        retryCount: 0,
      },
      advancedMetricsDefaulted: false,
      advancedMetricsObserved: true,
    },
  };
}
