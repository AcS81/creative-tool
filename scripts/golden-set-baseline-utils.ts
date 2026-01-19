import crypto from "node:crypto";

export type GoldenCoverageTotals = {
  observed: number;
  total: number;
  observedPct: number;
};

export type GoldenCoverageSummary = {
  core: Record<string, GoldenCoverageTotals>;
  advanced?: Record<string, GoldenCoverageTotals>;
};

export type GoldenRunTotals = {
  pass: number;
  fail: number;
  skipped: number;
  analyzed: number;
};

export type GoldenSummary = {
  schemaVersion: string;
  schemaHash: string;
  goldenSetHash: string;
  goldenSetSource: string;
  generatedAt: string;
  run: GoldenRunTotals;
  coverage: GoldenCoverageSummary;
  analysisMode?: "legacy" | "tiered";
  tier1ObservedPct?: number;
  tier2ObservedPct?: number;
};

export type GoldenBaseline = GoldenSummary & {
  thresholds?: {
    maxCoverageDropPct?: number;
  };
  pending?: boolean;
  notes?: string;
};

export const DEFAULT_MAX_COVERAGE_DROP_PCT = 10;

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

export const buildGoldenSetHash = (
  videos: Array<{ id: string; url: string; expected: unknown }>,
) => {
  const payload = videos.map((video) => ({
    id: video.id,
    url: video.url,
    expected: video.expected,
  }));
  return crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
};

export const buildCoverageSummary = (
  aggregate: Record<string, { observed: number; total: number }>,
): Record<string, GoldenCoverageTotals> => {
  const summary: Record<string, GoldenCoverageTotals> = {};
  for (const [key, value] of Object.entries(aggregate)) {
    const observed = value.observed;
    const total = value.total;
    const observedPct = total === 0 ? 0 : Math.round((observed / total) * 100);
    summary[key] = { observed, total, observedPct };
  }
  return summary;
};

export const compareGoldenSummaries = (
  baseline: GoldenBaseline,
  summary: GoldenSummary,
) => {
  const failures: string[] = [];
  const maxCoverageDropPct =
    baseline.thresholds?.maxCoverageDropPct ?? DEFAULT_MAX_COVERAGE_DROP_PCT;

  if (baseline.pending) {
    failures.push("Baseline is marked pending. Regenerate it with --write-baseline.");
    return { failures, maxCoverageDropPct };
  }

  if (baseline.schemaVersion !== summary.schemaVersion) {
    failures.push(
      `Schema version mismatch: baseline=${baseline.schemaVersion} current=${summary.schemaVersion}`,
    );
  }
  if (baseline.schemaHash !== summary.schemaHash) {
    failures.push(
      `Schema hash mismatch: baseline=${baseline.schemaHash} current=${summary.schemaHash}`,
    );
  }
  if (baseline.goldenSetHash !== summary.goldenSetHash) {
    failures.push(
      `Golden set hash mismatch: baseline=${baseline.goldenSetHash} current=${summary.goldenSetHash}`,
    );
  }

  if (baseline.run.fail > 0) {
    failures.push("Baseline run includes failures; regenerate baseline before gating.");
  }
  if (summary.run.fail > 0) {
    failures.push(`Golden run has ${summary.run.fail} failures; fix regressions first.`);
  }
  if (summary.run.skipped > 0) {
    failures.push(`Golden run skipped ${summary.run.skipped} videos; update URLs before gating.`);
  }
  if (baseline.run.analyzed > summary.run.analyzed) {
    failures.push(
      `Golden run analyzed fewer videos than baseline (${summary.run.analyzed}/${baseline.run.analyzed}).`,
    );
  }

  const compareCoverage = (
    label: string,
    baselineSection: Record<string, GoldenCoverageTotals> | undefined,
    currentSection: Record<string, GoldenCoverageTotals> | undefined,
  ) => {
    if (!baselineSection) return;
    if (!currentSection) {
      failures.push(`Missing ${label} coverage in current run.`);
      return;
    }
    for (const [key, baselineStat] of Object.entries(baselineSection)) {
      const currentStat = currentSection[key];
      if (!currentStat) {
        failures.push(`Missing ${label}.${key} coverage in current run.`);
        continue;
      }
      const drop = baselineStat.observedPct - currentStat.observedPct;
      if (drop > maxCoverageDropPct) {
        failures.push(
          `${label}.${key} coverage ${baselineStat.observedPct}% -> ${currentStat.observedPct}% (drop ${drop} > ${maxCoverageDropPct})`,
        );
      }
    }
  };

  compareCoverage("core", baseline.coverage.core, summary.coverage.core);
  const baselineMode = baseline.analysisMode ?? "legacy";
  const summaryMode = summary.analysisMode ?? "legacy";
  const compareAdvanced = baselineMode !== "tiered" && summaryMode !== "tiered";
  if (compareAdvanced) {
    compareCoverage("advanced", baseline.coverage.advanced, summary.coverage.advanced);
  }

  return { failures, maxCoverageDropPct };
};
