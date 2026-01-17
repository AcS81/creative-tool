export type AnalysisStage = "queued" | "ingestion" | "core" | "advanced" | "performance" | "finalize";

export type ClaimableJobInput = {
  status?: string | null;
  nextAttemptAt?: Date | string | null;
  leaseExpiresAt?: Date | string | null;
};

export type ResumePlan = {
  resetStages: boolean;
  resumeStage: AnalysisStage;
  useIngestion: boolean;
  useCore: boolean;
  useAdvanced: boolean;
};

const toDate = (value: Date | string | null | undefined) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isJobClaimable = (job: ClaimableJobInput, now: Date = new Date()) => {
  if (!job.status) return false;
  if (job.status === "pending") {
    const nextAttemptAt = toDate(job.nextAttemptAt);
    return !nextAttemptAt || nextAttemptAt <= now;
  }
  if (job.status === "running") {
    const leaseExpiresAt = toDate(job.leaseExpiresAt);
    return !leaseExpiresAt || leaseExpiresAt <= now;
  }
  return false;
};

export const resolveResumePlan = (input: {
  storedConfigHash?: string | null;
  storedSchemaHash?: string | null;
  currentConfigHash: string;
  currentSchemaHash: string;
  hasIngestion: boolean;
  hasCore: boolean;
  hasAdvanced: boolean;
  advancedMetricsEnabled: boolean;
}): ResumePlan => {
  const matchesConfig =
    input.storedConfigHash === input.currentConfigHash &&
    input.storedSchemaHash === input.currentSchemaHash;

  if (!matchesConfig) {
    return {
      resetStages: true,
      resumeStage: "ingestion",
      useIngestion: false,
      useCore: false,
      useAdvanced: false,
    };
  }

  const useIngestion = input.hasIngestion;
  const useCore = input.hasCore;
  const useAdvanced = input.advancedMetricsEnabled && input.hasAdvanced;

  let resumeStage: AnalysisStage = "performance";
  if (!useIngestion) {
    resumeStage = "ingestion";
  } else if (!useCore) {
    resumeStage = "core";
  } else if (input.advancedMetricsEnabled && !useAdvanced) {
    resumeStage = "advanced";
  }

  return {
    resetStages: false,
    resumeStage,
    useIngestion,
    useCore,
    useAdvanced,
  };
};
