import { describe, expect, it } from "vitest";
import type { DomainProfile, FingerprintPerDomain } from "../types";
import type { DomainKey } from "../archetypes/descriptions";
import { buildVideoFingerprint } from "./fingerprint/videoFingerprint";
import { getAxesForDomain, resolveAxisMetadata, metaAxesMetadata } from "./axisMetadata";

const buildProfile = (domain: DomainKey, baseValue: number): DomainProfile => {
  const axes = getAxesForDomain(domain).slice(0, 3);
  return {
    primaryArchetype: `${domain} archetype`,
    summaryText: `${domain} summary`,
    scores: axes.map((axis, idx) => ({
      key: axis.id,
      label: axis.label,
      value: baseValue + idx * 5,
    })),
  };
};

describe("axisMetadata", () => {
  it("resolves every DomainScore key from a sample fingerprint", () => {
    const perDomain: FingerprintPerDomain = {
      voiceProfile: buildProfile("voice", 50),
      languageProfile: buildProfile("language", 55),
      narrativeProfile: buildProfile("narrative", 60),
      visualProfile: buildProfile("visual", 52),
      editingProfile: buildProfile("editing", 58),
      soundProfile: buildProfile("sound", 57),
    };

    const fingerprint = buildVideoFingerprint(perDomain, {
      metaAxes: {
        voiceIntensity: 50,
        conceptualDepth: 55,
        narrativeStructureStrength: 60,
        visualDynamism: 54,
        productionPolish: 57,
      },
    });

    const allScores = Object.values(fingerprint.perDomain).flatMap((profile) => profile.scores);
    allScores.forEach((score) => {
      expect(resolveAxisMetadata(score.key)).toBeDefined();
    });
  });

  it("exposes meta axes with labels and short descriptions", () => {
    metaAxesMetadata.forEach((axis) => {
      expect(axis.label.length).toBeGreaterThan(0);
      expect(axis.shortDescription.length).toBeGreaterThan(0);
    });
  });
});
