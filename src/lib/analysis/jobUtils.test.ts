import { describe, expect, it } from "vitest";
import { isJobClaimable, resolveResumePlan } from "./jobUtils";

describe("jobUtils", () => {
  it("detects claimable jobs based on status and timing", () => {
    const now = new Date("2024-01-01T00:00:00Z");
    expect(isJobClaimable({ status: "pending", nextAttemptAt: null }, now)).toBe(true);
    expect(
      isJobClaimable({ status: "pending", nextAttemptAt: "2024-01-01T00:01:00Z" }, now),
    ).toBe(false);
    expect(
      isJobClaimable({ status: "running", leaseExpiresAt: "2023-12-31T23:59:00Z" }, now),
    ).toBe(true);
    expect(
      isJobClaimable({ status: "running", leaseExpiresAt: "2024-01-01T00:01:00Z" }, now),
    ).toBe(false);
    expect(isJobClaimable({ status: "complete" }, now)).toBe(false);
  });

  it("resets stages when config hashes drift", () => {
    const plan = resolveResumePlan({
      storedConfigHash: "old",
      storedSchemaHash: "old",
      currentConfigHash: "new",
      currentSchemaHash: "new",
      hasStructure: true,
      hasIngestion: true,
      hasCore: true,
      hasAdvanced: true,
      advancedMetricsEnabled: true,
    });
    expect(plan.resetStages).toBe(true);
    expect(plan.resumeStage).toBe("ingestion");
    expect(plan.useCore).toBe(false);
  });

  it("resumes at the next incomplete stage", () => {
    const plan = resolveResumePlan({
      storedConfigHash: "hash",
      storedSchemaHash: "schema",
      currentConfigHash: "hash",
      currentSchemaHash: "schema",
      hasStructure: true,
      hasIngestion: true,
      hasCore: true,
      hasAdvanced: false,
      advancedMetricsEnabled: true,
    });
    expect(plan.resetStages).toBe(false);
    expect(plan.resumeStage).toBe("advanced");
    expect(plan.useCore).toBe(true);
  });

  it("skips advanced stage when advanced metrics are disabled", () => {
    const plan = resolveResumePlan({
      storedConfigHash: "hash",
      storedSchemaHash: "schema",
      currentConfigHash: "hash",
      currentSchemaHash: "schema",
      hasStructure: true,
      hasIngestion: true,
      hasCore: true,
      hasAdvanced: true,
      advancedMetricsEnabled: false,
    });
    expect(plan.resetStages).toBe(false);
    expect(plan.resumeStage).toBe("performance");
    expect(plan.useAdvanced).toBe(false);
  });

  it("inserts structure stage before core when missing", () => {
    const plan = resolveResumePlan({
      storedConfigHash: "hash",
      storedSchemaHash: "schema",
      currentConfigHash: "hash",
      currentSchemaHash: "schema",
      hasStructure: false,
      hasIngestion: true,
      hasCore: false,
      hasAdvanced: false,
      advancedMetricsEnabled: false,
    });
    expect(plan.resumeStage).toBe("structure");
    expect(plan.useStructure).toBe(false);
  });

  it("skips structure when core is already available", () => {
    const plan = resolveResumePlan({
      storedConfigHash: "hash",
      storedSchemaHash: "schema",
      currentConfigHash: "hash",
      currentSchemaHash: "schema",
      hasStructure: false,
      hasIngestion: true,
      hasCore: true,
      hasAdvanced: false,
      advancedMetricsEnabled: false,
    });
    expect(plan.resumeStage).toBe("performance");
    expect(plan.useStructure).toBe(true);
  });
});
