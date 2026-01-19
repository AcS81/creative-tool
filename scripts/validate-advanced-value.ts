import fs from "node:fs";
import path from "node:path";
import { analyzeVideoMultimodal } from "../src/lib/analysis/geminiMultimodalAnalyzer";
import { runStructurePass } from "../src/lib/analysis/structurePass";
import { buildVideoFingerprint, computeMetaAxesFromProfiles } from "../src/lib/analysis/fingerprint/videoFingerprint";
import { buildDefaultAdvancedMetrics } from "../src/lib/analysis/fingerprint/defaults";
import { planAdvancedAnalysis } from "../src/lib/analysis/advancedPlanner";
import { executeAdvancedPass } from "../src/lib/analysis/advancedPass";
import { mergeAdvancedSegments, isObservedMetric } from "../src/lib/analysis/advancedMapping";
import {
  buildAdvancedPassConfig,
  buildAdvancedPlannerConfig,
  resolveAdvancedStrategy,
} from "../src/lib/analysis/advancedStrategy";
import { buildUnobservedCoreMetrics } from "../src/lib/analysis/aggregation";
import { advancedInsights } from "../src/lib/analysis/insights";
import type { AppConfig } from "../src/lib/config";
import type { SegmentAdvancedMetrics } from "../src/lib/analysis/types/advancedMetrics";
import type { AdvancedFingerprintMetrics, FingerprintPerDomain, ScoredMetric } from "../src/lib/types";

type GoldenVideo = {
  id: string;
  url: string;
  notes?: string;
};

type TimelineStats = {
  total: number;
  nonTrivial: number;
  empty: number;
};

const DEFAULT_ADVANCED_MAX_SEGMENTS = 5;
const DEFAULT_ADVANCED_SEGMENT_MAX_SECONDS = 120;
const DEFAULT_ADVANCED_MAX_TIMELINE_POINTS = 25;
const DEFAULT_ADVANCED_MAX_PASS_COST_USD = 0.25;
const DEFAULT_ADVANCED_MAX_PASS_DURATION_MS = 180000;
const DEFAULT_STRUCTURE_PASS_TIMEOUT_MS = 30000;

const DEFAULT_GOLDEN_SET_PATH = path.resolve(process.cwd(), "scripts/golden-set.json");
const SAMPLE_GOLDEN_SET_PATH = path.resolve(process.cwd(), "scripts/golden-set.sample.json");

const parseOptionalInt = (raw: string | undefined) => {
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

const parseOptionalFloat = (raw: string | undefined) => {
  if (!raw) return undefined;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

const parseOptionalBoolean = (raw: string | undefined) => {
  if (!raw) return undefined;
  const normalized = raw.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
};

const loadGoldenSet = (): { sourcePath: string; videos: GoldenVideo[] } => {
  const candidates = [DEFAULT_GOLDEN_SET_PATH, SAMPLE_GOLDEN_SET_PATH];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const raw = fs.readFileSync(candidate, "utf8");
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        return { sourcePath: candidate, videos: data as GoldenVideo[] };
      }
    } catch (error) {
      console.warn(`Failed to load golden set from ${candidate}.`, error);
    }
  }
  return { sourcePath: "none", videos: [] };
};

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

const hasObservedAdvancedMetrics = (metrics: AdvancedFingerprintMetrics) =>
  Object.values(metrics).some((section) => 
    Object.values(section ?? {}).some((metric) => isObservedMetric(metric as ScoredMetric | undefined))
  );

const collectSegmentMetrics = (segment: SegmentAdvancedMetrics) => [
  ...Object.values(segment.prosodyArc ?? {}),
  ...Object.values(segment.languageTexture ?? {}),
  ...Object.values(segment.narrativeArc ?? {}),
  ...Object.values(segment.visualEditAlignment ?? {}),
];

const isNonTrivialTimeline = (timeline: Array<{ value?: number }> | undefined) => {
  if (!timeline || timeline.length < 2) return false;
  const values = timeline
    .map((point) => point.value)
    .filter((value): value is number => typeof value === "number");
  if (values.length < 2) return false;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return Math.abs(max - min) > 0.001;
};

const computeTimelineStats = (segments: SegmentAdvancedMetrics[] | undefined): TimelineStats => {
  if (!segments || segments.length === 0) return { total: 0, nonTrivial: 0, empty: 0 };
  const stats: TimelineStats = { total: 0, nonTrivial: 0, empty: 0 };
  for (const segment of segments) {
    for (const metric of collectSegmentMetrics(segment)) {
      const timeline = (metric as { timeline?: Array<{ value?: number }> }).timeline;
      if (!Array.isArray(timeline)) continue;
      stats.total += 1;
      if (timeline.length === 0) {
        stats.empty += 1;
        continue;
      }
      if (isNonTrivialTimeline(timeline)) {
        stats.nonTrivial += 1;
      }
    }
  }
  return stats;
};

async function run() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is required to validate advanced value.");
    process.exit(1);
  }

  const { sourcePath, videos } = loadGoldenSet();
  if (sourcePath !== "none") {
    console.log(`Golden set loaded from: ${sourcePath}`);
  }
  if (videos.length === 0) {
    console.error("No golden set videos available. Create scripts/golden-set.json or set GOLDEN_SET_PATH.");
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
    advancedMaxSegments: parseOptionalInt(process.env.MAX_ADVANCED_SEGMENTS) ?? DEFAULT_ADVANCED_MAX_SEGMENTS,
    advancedSegmentMaxSeconds:
      parseOptionalInt(process.env.ADVANCED_SEGMENT_MAX_SECONDS) ?? DEFAULT_ADVANCED_SEGMENT_MAX_SECONDS,
    advancedMaxTimelinePoints:
      parseOptionalInt(process.env.MAX_TIMELINE_POINTS) ?? DEFAULT_ADVANCED_MAX_TIMELINE_POINTS,
    advancedMaxPassCostUsd:
      parseOptionalFloat(process.env.MAX_ADVANCED_PASS_COST_USD) ?? DEFAULT_ADVANCED_MAX_PASS_COST_USD,
    advancedMaxPassDurationMs:
      parseOptionalInt(process.env.MAX_ADVANCED_PASS_DURATION_MS) ?? DEFAULT_ADVANCED_MAX_PASS_DURATION_MS,
    structurePassEnabled: true,
    structurePassTimeoutMs:
      parseOptionalInt(process.env.STRUCTURE_PASS_TIMEOUT_MS) ?? DEFAULT_STRUCTURE_PASS_TIMEOUT_MS,
    geminiMultimodalCoreModel: process.env.GEMINI_MULTIMODAL_CORE_MODEL,
    geminiMultimodalAdvancedAudioModel: process.env.GEMINI_MULTIMODAL_ADV_AUDIO_MODEL,
    geminiMultimodalAdvancedVisualModel: process.env.GEMINI_MULTIMODAL_ADV_VISUAL_MODEL,
    geminiMultimodalSalvageModel: process.env.GEMINI_MULTIMODAL_SALVAGE_MODEL,
    geminiMultimodalTimeoutMs: parseOptionalInt(process.env.GEMINI_MULTIMODAL_TIMEOUT_MS),
    geminiMultimodalTimeoutMsCore: parseOptionalInt(process.env.GEMINI_MULTIMODAL_TIMEOUT_MS_CORE),
    geminiMultimodalTimeoutMsAdvanced: parseOptionalInt(process.env.GEMINI_MULTIMODAL_TIMEOUT_MS_ADVANCED),
    geminiMultimodalTimeoutMsSalvage: parseOptionalInt(process.env.GEMINI_MULTIMODAL_TIMEOUT_MS_SALVAGE),
    geminiResponseSchemaEnabled: parseOptionalBoolean(process.env.GEMINI_RESPONSE_SCHEMA_ENABLED) ?? false,
    useTieredAnalysis: true,
    showArchetypeFeatures: false,
    showReferenceLibrary: false,
  };

  let passCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (const video of videos) {
    if (!video.url || video.url.includes("REPLACE_")) {
      console.warn(`\n=== Video ${video.id}: skipped (url not set)`);
      skipCount += 1;
      continue;
    }

    console.log(`\n=== Video ${video.id}: ${video.url}`);
    if (video.notes) {
      console.log(`Notes: ${video.notes}`);
    }

    const startedAt = Date.now();
    const failures: string[] = [];

    try {
      const structureResult = await runStructurePass({ youtubeUrl: video.url }, { config });
      const analysis = await analyzeVideoMultimodal({
        youtubeUrl: video.url,
        config,
        useTieredAnalysis: true,
        skeleton: structureResult.skeleton,
      });

      const coreInput = analysis.coreMetrics
        ? { aggregated: analysis.coreMetrics, perChapterMetrics: analysis.perChapterMetrics ?? [] }
        : buildUnobservedCoreMetrics();
      const strategy = resolveAdvancedStrategy(structureResult.skeleton.durationSeconds);
      const plannerConfig = buildAdvancedPlannerConfig(config, strategy);
      const plan = planAdvancedAnalysis(structureResult.skeleton, coreInput, plannerConfig);
      const passConfig = buildAdvancedPassConfig(config, strategy);

      let advancedSegments: SegmentAdvancedMetrics[] = [];
      if (plan.segments.length > 0) {
        const advancedResult = await executeAdvancedPass(
          plan,
          {
            youtubeUrl: video.url,
            skeleton: structureResult.skeleton,
            config,
          },
          passConfig,
        );
        advancedSegments = advancedResult.segments;
      }

      const mergedAdvanced =
        advancedSegments.length > 0 ? mergeAdvancedSegments(advancedSegments) : buildDefaultAdvancedMetrics();
      const perDomain = toFingerprintDomains(analysis.profiles);
      const metaAxes = computeMetaAxesFromProfiles(perDomain);
      const fingerprintAdvanced = buildVideoFingerprint(perDomain, {
        metaAxes,
        supporting: { beats: analysis.beats, axisDetails: analysis.axisDetails },
        advancedMetrics: mergedAdvanced,
      });
      const fingerprintBaseline = buildVideoFingerprint(perDomain, {
        metaAxes,
        supporting: { beats: analysis.beats, axisDetails: analysis.axisDetails },
        advancedMetrics: buildDefaultAdvancedMetrics(),
      });

      if (advancedSegments.length === 0) {
        failures.push("No advanced segments returned.");
      }

      const observedAdvanced = hasObservedAdvancedMetrics(mergedAdvanced);
      if (!observedAdvanced) {
        failures.push("No observed advanced metrics.");
      }

      const advancedOnlyInsights = advancedInsights(fingerprintAdvanced);
      const baselineInsights = advancedInsights(fingerprintBaseline);
      if (baselineInsights.length > 0) {
        console.warn("Baseline advanced insights were non-empty; check default metrics mapping.");
      }
      if (observedAdvanced && advancedOnlyInsights.length === 0) {
        failures.push("Advanced metrics did not surface any insights.");
      }

      const timelineStats = computeTimelineStats(advancedSegments);
      if (timelineStats.total === 0) {
        failures.push("No advanced timelines returned.");
      } else if (timelineStats.nonTrivial === 0) {
        failures.push("All advanced timelines are flat or empty.");
      }

      console.log(
        `Insights -> advanced=${advancedOnlyInsights.length}, baseline=${baselineInsights.length}`,
      );
      if (advancedOnlyInsights.length > 0) {
        console.log(`Advanced insights: ${advancedOnlyInsights.join(" | ")}`);
      }
      console.log(
        `Timelines -> non-trivial=${timelineStats.nonTrivial}/${timelineStats.total}, empty=${timelineStats.empty}`,
      );

      if (failures.length > 0) {
        console.error(`FAIL: ${failures.join("; ")}`);
        failCount += 1;
        process.exitCode = 1;
      } else {
        console.log("Result: PASS");
        passCount += 1;
      }
    } catch (error) {
      console.error(`Failed for ${video.url}:`, error instanceof Error ? error.message : String(error));
      failCount += 1;
      process.exitCode = 1;
    } finally {
      console.log(`Duration: ${Date.now() - startedAt} ms`);
    }
  }

  console.log("\n=== Advanced value summary ===");
  console.log(`PASS: ${passCount}  FAIL: ${failCount}  SKIP: ${skipCount}`);
  if (passCount === 0 && failCount === 0) {
    console.error("No runnable golden clips. Update scripts/golden-set.json or set GOLDEN_SET_PATH.");
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("Advanced value validation failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
