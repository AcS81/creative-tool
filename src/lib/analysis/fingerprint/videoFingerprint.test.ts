import { describe, expect, it } from "vitest";
import type { FingerprintPerDomain } from "../../types";
import { buildVideoFingerprint, computeMetaAxesFromProfiles } from "./videoFingerprint";

const makeDomain = (value: number) => ({
  primaryArchetype: "Archetype",
  summaryText: "Summary",
  scores: [
    { key: "a", label: "A", value },
    { key: "b", label: "B", value },
  ],
});

const profiles: FingerprintPerDomain = {
  voiceProfile: makeDomain(60),
  languageProfile: makeDomain(70),
  narrativeProfile: makeDomain(65),
  visualProfile: makeDomain(55),
  editingProfile: makeDomain(62),
  soundProfile: makeDomain(58),
};

describe("videoFingerprint builder", () => {
  it("computes meta axes from domain profiles", () => {
    const axes = computeMetaAxesFromProfiles(profiles);
    expect(axes.voiceIntensity).toBeGreaterThan(0);
    expect(axes.productionPolish).toBeGreaterThan(0);
  });

  it("builds a fingerprint with defaults", () => {
    const fingerprint = buildVideoFingerprint(profiles, {
      supporting: { beats: [{ startSeconds: 0, endSeconds: 10, label: "hook", devices: [] }] },
    });
    expect(fingerprint.version).toBe("1.2.0");
    expect(fingerprint.hasPerformanceData).toBe(false);
    expect(fingerprint.supporting?.beats?.length).toBe(1);
  });
});
