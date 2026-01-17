import fs from "node:fs";
import path from "node:path";
import { analyzeVideoMultimodal } from "../src/lib/analysis/geminiMultimodalAnalyzer";
import { buildVideoFingerprint, computeMetaAxesFromProfiles } from "../src/lib/analysis/fingerprint/videoFingerprint";
import type { AppConfig } from "../src/lib/config";
import type { FingerprintPerDomain } from "../src/lib/types/fingerprint";
import { buildDefaultAdvancedMetrics } from "../src/lib/analysis/fingerprint/defaults";
import { BASE_DOMAIN_METRICS } from "../src/lib/analysis/metricRegistry";
import { FINGERPRINT_SCHEMA_VERSION } from "../src/lib/schemas/fingerprintContract";
import { FINGERPRINT_SCHEMA_HASH } from "../src/lib/schemas/fingerprintSchemaHash";
import {
  buildCoverageSummary,
  buildGoldenSetHash,
  compareGoldenSummaries,
  DEFAULT_MAX_COVERAGE_DROP_PCT,
  type GoldenBaseline,
  type GoldenSummary,
} from "./golden-set-baseline-utils";

type ValueRange = {
  min?: number;
  max?: number;
};

type GoldenExpectation = {
  story?: "low" | "medium" | "high";
  music?: "none" | "light" | "medium" | "heavy";
  pacing?: "slow" | "medium" | "fast";
  musicCoveragePct?: ValueRange;
  speakingRateWpm?: ValueRange;
  storyScore?: ValueRange;
  minSilenceSpans?: number;
  minAudienceAddresses?: number;
  maxHookSeconds?: number;
  entropyTimelineRequired?: boolean;
  cutTimelineRequired?: boolean;
};

type GoldenVideo = {
  id: string;
  url: string;
  notes: string;
  expected: GoldenExpectation;
};

type CoverageStat = {
  observed: number;
  total: number;
  observedPct: number;
  available: boolean;
};

type CoverageDiagnostics = {
  core: Record<string, CoverageStat>;
  advanced?: Record<string, CoverageStat>;
};

const DEFAULT_GOLDEN_SET_PATH = path.resolve(process.cwd(), "scripts/golden-set.json");
const SAMPLE_GOLDEN_SET_PATH = path.resolve(process.cwd(), "scripts/golden-set.sample.json");
const DEFAULT_SUMMARY_PATH = path.resolve(process.cwd(), "scripts/golden-set.summary.json");

const args = process.argv.slice(2);
const hasFlag = (flag: string) => args.includes(flag);
const getArgValue = (flag: string) => {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
};

const WRITE_BASELINE = hasFlag("--write-baseline");
const WRITE_SUMMARY = hasFlag("--write-summary");
const SKIP_BASELINE_CHECK = hasFlag("--skip-baseline-check");
const BASELINE_PATH = getArgValue("--baseline-path") ?? path.resolve(
  process.cwd(),
  `scripts/golden-set.baseline.v${FINGERPRINT_SCHEMA_VERSION}.json`,
);
const SUMMARY_PATH = getArgValue("--summary-path") ?? DEFAULT_SUMMARY_PATH;
const maxCoverageDropArg = getArgValue("--max-coverage-drop");
const maxCoverageDropValue = maxCoverageDropArg ? Number.parseFloat(maxCoverageDropArg) : NaN;
const MAX_COVERAGE_DROP_PCT = Number.isFinite(maxCoverageDropValue)
  ? maxCoverageDropValue
  : DEFAULT_MAX_COVERAGE_DROP_PCT;

const loadGoldenSet = (): {
  sourcePath: string;
  sourceLabel: string;
  videos: GoldenVideo[];
} => {
  const candidates: { path?: string; label: string }[] = [
    { path: process.env.GOLDEN_SET_PATH, label: "GOLDEN_SET_PATH" },
    { path: DEFAULT_GOLDEN_SET_PATH, label: "scripts/golden-set.json" },
    { path: SAMPLE_GOLDEN_SET_PATH, label: "scripts/golden-set.sample.json" },
  ];

  for (const candidate of candidates) {
    if (!candidate.path) continue;
    const resolvedPath = path.resolve(process.cwd(), candidate.path);
    if (!fs.existsSync(resolvedPath)) continue;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const data = require(resolvedPath);
      if (Array.isArray(data)) {
        return { sourcePath: resolvedPath, sourceLabel: candidate.label, videos: data as GoldenVideo[] };
      }
      console.warn(`Golden set file did not contain an array, skipping. (${resolvedPath})`);
    } catch (error) {
      console.warn(`Failed to load golden set (${resolvedPath}), skipping.`, error);
    }
  }

  return { sourcePath: "none", sourceLabel: "none", videos: [] };
};

const getScore = (domain: keyof ReturnType<typeof computeMetaAxesFromProfiles> | string, axis: string, axisDetails?: Record<string, { rawValue?: string }>) => {
  const key = axis.includes(".") ? axis : `${domain}.${axis}`;
  return axisDetails?.[key];
};

const summarize = (video: GoldenVideo, axisDetails?: Record<string, { rawValue?: string; observed?: boolean }>) => {
  const music = getScore("sound", "music_coverage", axisDetails)?.rawValue || "n/a";
  const musicChanges = getScore("sound", "music_changes", axisDetails)?.rawValue || "n/a";
  const cutRate = getScore("editing", "cut_rate", axisDetails)?.rawValue || "n/a";
  const story = getScore("narrative", "story_presence", axisDetails)?.rawValue || "n/a";
  const alignmentScore = getScore("secondOrder", "alignmentScore", axisDetails)?.rawValue || "n/a";
  const loadHighlight = getScore("cognitiveLoad", "loadHighlights", axisDetails)?.rawValue || "n/a";
  const modalityBalance = getScore("modalityBalance", "redundancyVsComplementarity", axisDetails)?.rawValue || "n/a";
  return {
    musicCoverage: music,
    musicChanges,
    cutRate,
    storyPresence: story,
    alignmentScore,
    loadHighlight,
    modalityBalance,
    expected: video.expected,
  };
};

const toNumber = (value?: string | number) => {
  if (typeof value === "number") return value;
  if (!value) return undefined;
  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : undefined;
};

const normalizeBucket = <T extends string>(value: string | undefined, buckets: Record<T, string[]>) => {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  const entries = Object.entries(buckets) as [T, string[]][];
  for (const [bucket, keywords] of entries) {
    if (keywords.some((keyword) => lower.includes(keyword))) return bucket;
  }
  return undefined;
};

const bucketMusicCoverage = (rawValue?: string) => {
  const normalized = normalizeBucket(rawValue, {
    none: ["none", "no music"],
    light: ["light", "low"],
    medium: ["medium", "moderate"],
    heavy: ["heavy", "high"],
  });
  if (normalized) return normalized;
  const pct = toNumber(rawValue);
  if (pct === undefined) return undefined;
  if (pct <= 5) return "none";
  if (pct <= 35) return "light";
  if (pct <= 65) return "medium";
  return "heavy";
};

const bucketPacing = (rawValue?: string) => {
  const normalized = normalizeBucket(rawValue, {
    slow: ["slow"],
    medium: ["medium", "moderate"],
    fast: ["fast"],
  });
  if (normalized) return normalized;
  const wpm = toNumber(rawValue);
  if (wpm === undefined) return undefined;
  if (wpm < 120) return "slow";
  if (wpm < 170) return "medium";
  return "fast";
};

const bucketStory = (rawValue: string | undefined, score: number | undefined) => {
  if (score !== undefined && score !== 0) {
    if (score < 40) return "low";
    if (score < 70) return "medium";
    return "high";
  }
  return normalizeBucket(rawValue, {
    low: ["low", "weak", "none"],
    medium: ["medium", "moderate", "present"],
    high: ["high", "strong"],
  });
};

const checkRange = (label: string, value: number | undefined, range: ValueRange | undefined, failures: string[]) => {
  if (!range || (range.min === undefined && range.max === undefined)) return;
  if (value === undefined) {
    failures.push(`${label}=unobserved`);
    return;
  }
  if (range.min !== undefined && value < range.min) {
    failures.push(`${label}=${value} < ${range.min}`);
  }
  if (range.max !== undefined && value > range.max) {
    failures.push(`${label}=${value} > ${range.max}`);
  }
};

const getScoreValue = (scores: { key: string; value: number }[] | undefined, axisKey: string) =>
  scores?.find((score) => score.key === axisKey)?.value;

const buildCoverageStat = (total: number, unobserved: number): CoverageStat => {
  const observed = Math.max(0, total - unobserved);
  const observedPct = total === 0 ? 0 : Math.round((observed / total) * 100);
  return { observed, total, observedPct, available: true };
};

const buildFallbackCoverage = (unobservedCounts: Record<string, number>): CoverageDiagnostics => ({
  core: {
    voice: buildCoverageStat(BASE_DOMAIN_METRICS.voice.length, unobservedCounts.voice ?? 0),
    language: buildCoverageStat(BASE_DOMAIN_METRICS.language.length, unobservedCounts.language ?? 0),
    narrative: buildCoverageStat(BASE_DOMAIN_METRICS.narrative.length, unobservedCounts.narrative ?? 0),
    visual_edit_sound: buildCoverageStat(
      BASE_DOMAIN_METRICS.visual_edit_sound.length,
      unobservedCounts.visual_edit_sound ?? 0,
    ),
  },
});

const formatCoverageStat = (label: string, stat: CoverageStat) => {
  if (!stat.available) return `${label}: n/a`;
  return `${label}: ${stat.observed}/${stat.total} (${stat.observedPct}%)`;
};

const formatCoverageGroup = (label: string, stats: Record<string, CoverageStat>) =>
  `${label} ${Object.entries(stats)
    .map(([key, stat]) => formatCoverageStat(key, stat))
    .join(", ")}`;

const addCoverageAggregate = (aggregate: Record<string, { observed: number; total: number }>, stats?: Record<string, CoverageStat>) => {
  if (!stats) return;
  for (const [key, stat] of Object.entries(stats)) {
    if (!stat.available) continue;
    const entry = aggregate[key] ?? { observed: 0, total: 0 };
    entry.observed += stat.observed;
    entry.total += stat.total;
    aggregate[key] = entry;
  }
};

const formatCoverageAggregate = (aggregate: Record<string, { observed: number; total: number }>) =>
  Object.entries(aggregate)
    .map(([key, value]) => {
      const pct = value.total === 0 ? 0 : Math.round((value.observed / value.total) * 100);
      return `${key}: ${pct}%`;
    })
    .join(", ");

const toFingerprintDomains = (
  profiles: Awaited<ReturnType<typeof analyzeVideoMultimodal>>["profiles"],
): FingerprintPerDomain => ({
  voiceProfile: profiles.voice,
  languageProfile: profiles.language,
  narrativeProfile: profiles.narrative,
  visualProfile: profiles.visual,
  editingProfile: profiles.editing,
  soundProfile: profiles.sound,
});

const shouldWarnAdvancedMetric = (
  analysis: Awaited<ReturnType<typeof analyzeVideoMultimodal>>,
  section: string,
  metricKey: string,
) => {
  const advancedCoverage = analysis.diagnostics.coverage?.advanced as
    | Record<string, { available?: boolean; missing?: string[] }>
    | undefined;
  const sectionStat = advancedCoverage?.[section];
  if (!sectionStat || !sectionStat.available) return true;
  if (metricKey && sectionStat.missing?.includes(metricKey)) return true;
  return false;
};

const warn = (message: string) => {
  console.warn(`WARN: ${message}`);
};

const checkExpectations = (video: GoldenVideo, analysis: Awaited<ReturnType<typeof analyzeVideoMultimodal>>) => {
  const failures: string[] = [];
  const adv = analysis.advancedMetrics ?? buildDefaultAdvancedMetrics();
  const beats = analysis.beats ?? [];
  const firstHook = beats.find((b) => b.role === "hook") ?? beats[0];
  const axisDetails = analysis.axisDetails;

  if (video.expected.maxHookSeconds) {
    const hookSeconds = firstHook?.startSeconds ?? toNumber(adv.narrativeArc.timeToHookSeconds.value);
    if (hookSeconds === undefined || hookSeconds > video.expected.maxHookSeconds) {
      const shouldWarn =
        !firstHook &&
        shouldWarnAdvancedMetric(analysis, "narrativeArc", "timeToHookSeconds");
      if (shouldWarn) {
        warn(`hookSeconds=${hookSeconds ?? "unobserved"} > ${video.expected.maxHookSeconds}`);
      } else {
        failures.push(`hookSeconds=${hookSeconds ?? "unobserved"} > ${video.expected.maxHookSeconds}`);
      }
    }
  }

  if (video.expected.minSilenceSpans) {
    const spans = adv.visualEditAlignment.silenceForEmphasisFidelity.spans ?? [];
    if (spans.length < video.expected.minSilenceSpans) {
      if (shouldWarnAdvancedMetric(analysis, "visualEditAlignment", "silenceForEmphasisFidelity")) {
        warn(`silence spans ${spans.length} < ${video.expected.minSilenceSpans}`);
      } else {
        failures.push(`silence spans ${spans.length} < ${video.expected.minSilenceSpans}`);
      }
    }
  }

  if (video.expected.minAudienceAddresses) {
    const counts = adv.languageTexture.audienceAddressFrequency.counts;
    const total = (counts?.direct ?? 0) + (counts?.rhetorical ?? 0);
    if (total < video.expected.minAudienceAddresses) {
      if (shouldWarnAdvancedMetric(analysis, "languageTexture", "audienceAddressFrequency")) {
        warn(`audience addresses ${total} < ${video.expected.minAudienceAddresses}`);
      } else {
        failures.push(`audience addresses ${total} < ${video.expected.minAudienceAddresses}`);
      }
    }
  }

  const musicRaw = getScore("sound", "music_coverage", axisDetails)?.rawValue;
  const musicBucket = bucketMusicCoverage(musicRaw);
  checkRange("musicCoveragePct", toNumber(musicRaw), video.expected.musicCoveragePct, failures);
  if (video.expected.music) {
    if (!musicBucket) {
      failures.push("music coverage unobserved");
    } else if (musicBucket !== video.expected.music) {
      failures.push(`music coverage ${musicBucket} (raw=${musicRaw ?? "unobserved"}) != ${video.expected.music}`);
    }
  }

  const pacingRaw = getScore("voice", "speaking_rate", axisDetails)?.rawValue;
  const pacingBucket = bucketPacing(pacingRaw);
  checkRange("speakingRateWpm", toNumber(pacingRaw), video.expected.speakingRateWpm, failures);
  if (video.expected.pacing) {
    if (!pacingBucket) {
      failures.push("speaking rate unobserved");
    } else if (pacingBucket !== video.expected.pacing) {
      failures.push(`pacing ${pacingBucket} (raw=${pacingRaw ?? "unobserved"}) != ${video.expected.pacing}`);
    }
  }

  const storyRaw = getScore("narrative", "story_presence", axisDetails)?.rawValue;
  const storyScore = getScoreValue(analysis.profiles?.narrative?.scores, "narrative.story_presence");
  const storyBucket = bucketStory(storyRaw, storyScore);
  checkRange("storyScore", storyScore, video.expected.storyScore, failures);
  if (video.expected.story) {
    if (!storyBucket) {
      failures.push("story presence unobserved");
    } else if (storyBucket !== video.expected.story) {
      failures.push(`story presence ${storyBucket} (score=${storyScore ?? "n/a"}) != ${video.expected.story}`);
    }
  }

  if (video.expected.entropyTimelineRequired) {
    if (!adv.visualEditAlignment.visualEntropy.timeline?.length) {
      if (shouldWarnAdvancedMetric(analysis, "visualEditAlignment", "visualEntropy")) {
        warn("missing visualEntropy timeline");
      } else {
        failures.push("missing visualEntropy timeline");
      }
    }
  }

  if (video.expected.cutTimelineRequired) {
    if (!adv.visualEditAlignment.cutRateRefinement.timeline?.length) {
      if (shouldWarnAdvancedMetric(analysis, "visualEditAlignment", "cutRateRefinement")) {
        warn("missing cutRateRefinement timeline");
      } else {
        failures.push("missing cutRateRefinement timeline");
      }
    }
  }

  return failures;
};

const readBaseline = (baselinePath: string): GoldenBaseline | null => {
  if (!fs.existsSync(baselinePath)) return null;
  try {
    const raw = fs.readFileSync(baselinePath, "utf8");
    return JSON.parse(raw) as GoldenBaseline;
  } catch (error) {
    console.warn(`Failed to read baseline at ${baselinePath}.`, error);
    return null;
  }
};

const writeJson = (outputPath: string, payload: unknown) => {
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
};

async function run() {
  const { sourcePath, sourceLabel, videos: goldenSet } = loadGoldenSet();
  const goldenSetHash = buildGoldenSetHash(goldenSet);
  const coverageAggregateCore: Record<string, { observed: number; total: number }> = {};
  const coverageAggregateAdvanced: Record<string, { observed: number; total: number }> = {};
  let passCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is required to run the golden set evaluation.");
    process.exit(1);
  }

  const config: AppConfig = {
    analysisMode: "gemini",
    analysisVersion: "v2",
    analysisV2MultimodalEnabled: true,
    geminiApiKey: process.env.GEMINI_API_KEY,
    youtubeApiKey: process.env.YOUTUBE_API_KEY ?? "dev",
    performanceEnabled: false,
    advancedMetricsEnabled: true,
    geminiResponseSchemaEnabled: false,
  };

  if (sourcePath !== "none") {
    console.log(`Golden set loaded from: ${sourcePath}`);
  } else {
    console.warn("Golden set not found. Set GOLDEN_SET_PATH or create scripts/golden-set.json.");
  }

  for (const video of goldenSet) {
    if (!video.url || video.url.includes("REPLACE_")) {
      console.warn(`\n=== Video ${video.id}: skipped (url not set)`);
      skippedCount += 1;
      continue;
    }
    console.log(`\n=== Video ${video.id}: ${video.url}`);
    console.log(`Notes: ${video.notes}`);
    const start = Date.now();
    try {
      const analysis = await analyzeVideoMultimodal({ youtubeUrl: video.url, config });
      const perDomain = toFingerprintDomains(analysis.profiles);
      const fingerprint = buildVideoFingerprint(perDomain, {
        metaAxes: computeMetaAxesFromProfiles(perDomain),
        supporting: { beats: analysis.beats, axisDetails: analysis.axisDetails },
        advancedMetrics: analysis.advancedMetrics ?? buildDefaultAdvancedMetrics(),
      });
      const summary = summarize(video, fingerprint.supporting?.axisDetails);
      const failures = checkExpectations(video, analysis);
      const coverage = analysis.diagnostics.coverage ?? buildFallbackCoverage(analysis.diagnostics.unobservedCounts);
      console.log(`Status: ok unobserved=${JSON.stringify(analysis.diagnostics.unobservedCounts)}`);
      console.log(formatCoverageGroup("Coverage (core):", coverage.core));
      if (coverage.advanced) {
        console.log(formatCoverageGroup("Coverage (advanced):", coverage.advanced));
      }
      console.log(
        `Sound -> musicCoverage: ${summary.musicCoverage}, musicChanges: ${summary.musicChanges}; ` +
          `Editing -> cutRate: ${summary.cutRate}; Narrative -> storyPresence: ${summary.storyPresence}`,
      );
      console.log(
        `Alignment/load -> alignmentScore: ${summary.alignmentScore}; loadHighlights: ${summary.loadHighlight}; modalityBalance: ${summary.modalityBalance}`,
      );
      console.log(
        `Expected -> story: ${video.expected.story}, music: ${video.expected.music}, pacing: ${video.expected.pacing}`,
      );
      if (failures.length) {
        console.error(`FAIL: ${failures.join("; ")}`);
        failCount += 1;
        process.exitCode = 1;
      } else {
        console.log("Result: PASS");
        passCount += 1;
      }
      addCoverageAggregate(coverageAggregateCore, coverage.core);
      addCoverageAggregate(coverageAggregateAdvanced, coverage.advanced);
    } catch (error) {
      console.error(`Failed for ${video.url}:`, error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
      failCount += 1;
    } finally {
      console.log(`Duration: ${Date.now() - start} ms`);
    }
  }

  if (goldenSet.length === 0 || goldenSet.length === skippedCount) {
    console.error("No runnable golden clips. Update scripts/golden-set.json or set GOLDEN_SET_PATH.");
    process.exitCode = 1;
    return;
  }

  console.log("\n=== Golden set summary ===");
  console.log(`PASS: ${passCount}  FAIL: ${failCount}  SKIP: ${skippedCount}`);
  if (Object.keys(coverageAggregateCore).length > 0) {
    console.log(`Avg coverage (core): ${formatCoverageAggregate(coverageAggregateCore)}`);
  }
  if (Object.keys(coverageAggregateAdvanced).length > 0) {
    console.log(`Avg coverage (advanced): ${formatCoverageAggregate(coverageAggregateAdvanced)}`);
  }

  const summary: GoldenSummary = {
    schemaVersion: FINGERPRINT_SCHEMA_VERSION,
    schemaHash: FINGERPRINT_SCHEMA_HASH,
    goldenSetHash,
    goldenSetSource: sourceLabel,
    generatedAt: new Date().toISOString(),
    run: {
      pass: passCount,
      fail: failCount,
      skipped: skippedCount,
      analyzed: passCount + failCount,
    },
    coverage: {
      core: buildCoverageSummary(coverageAggregateCore),
      advanced:
        Object.keys(coverageAggregateAdvanced).length > 0
          ? buildCoverageSummary(coverageAggregateAdvanced)
          : undefined,
    },
  };

  console.log("\n=== Golden set compact summary ===");
  console.log(JSON.stringify(summary, null, 2));

  if (WRITE_SUMMARY) {
    writeJson(SUMMARY_PATH, summary);
    console.log(`Summary written to ${SUMMARY_PATH}`);
  }

  if (WRITE_BASELINE) {
    if (summary.run.fail > 0 || summary.run.skipped > 0) {
      console.error("Refusing to write baseline: fix failures and skipped videos first.");
      process.exitCode = 1;
      return;
    }
    const baseline: GoldenBaseline = {
      ...summary,
      thresholds: {
        maxCoverageDropPct: MAX_COVERAGE_DROP_PCT,
      },
    };
    writeJson(BASELINE_PATH, baseline);
    console.log(`Baseline written to ${BASELINE_PATH}`);
    return;
  }

  if (!SKIP_BASELINE_CHECK) {
    const baseline = readBaseline(BASELINE_PATH);
    if (!baseline) {
      console.error(`Baseline not found at ${BASELINE_PATH}. Run with --write-baseline to create it.`);
      process.exitCode = 1;
      return;
    }
    const { failures, maxCoverageDropPct } = compareGoldenSummaries(baseline, summary);
    if (failures.length) {
      console.error("\n=== Golden set baseline check failed ===");
      for (const failure of failures) {
        console.error(`- ${failure}`);
      }
      console.error(`Max coverage drop allowed: ${maxCoverageDropPct}%`);
      process.exitCode = 1;
      return;
    }
    console.log("\n=== Golden set baseline check ===");
    console.log("Baseline check: PASS");
  }
}

run().catch((error) => {
  console.error("Golden set runner failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
