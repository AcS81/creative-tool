import { describe, expect, it } from "vitest";
import { mockAnalyzeVideo } from "./mock";

describe("mockAnalyzeVideo", () => {
  it("returns stable fingerprint for same videoId", () => {
    const first = mockAnalyzeVideo({ videoId: "abc123" });
    const second = mockAnalyzeVideo({ videoId: "abc123" });
    expect(first.fingerprint.metaAxes).toStrictEqual(second.fingerprint.metaAxes);
    expect(first.overallArchetype).toBe(second.overallArchetype);
  });

  it("produces different output for different ids", () => {
    const a = mockAnalyzeVideo({ videoId: "abc123" });
    const b = mockAnalyzeVideo({ videoId: "xyz789" });
    expect(a.fingerprint.metaAxes).not.toStrictEqual(b.fingerprint.metaAxes);
  });

  it("validates fingerprint shape", () => {
    const result = mockAnalyzeVideo({ videoId: "valid123" });
    expect(result.fingerprint.version).toBe("1.2.0");
    expect(result.fingerprint.perDomain.voiceProfile.scores[0].value).toBeGreaterThanOrEqual(0);
  });
});
