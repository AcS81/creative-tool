import fs from "node:fs";
import path from "node:path";
import prisma from "../src/lib/db";
import { getAppConfig } from "../src/lib/config";
import { analyzeVideo } from "../src/lib/analysis/service";
import { validateFingerprint } from "../src/lib/schemas/fingerprint";
import { distanceOnMetaAxes } from "../src/lib/analysis/similarity";
import type { MetaAxes, ScoredMetric, VideoFingerprintJson } from "../src/lib/types";

const args = process.argv.slice(2);
const ALLOW_DRIFT = process.env.ALLOW_REFERENCE_DRIFT === "true";

const getArgValue = (flag: string) => {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
};

const parseListArg = (flag: string) => {
  const value = getArgValue(flag);
  if (!value) return [] as string[];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const ONLY_FILTERS = parseListArg("--only").map((value) => value.toLowerCase());
const limitArg = getArgValue("--limit");
const LIMIT = limitArg ? Number.parseInt(limitArg, 10) : undefined;
const OUTPUT_PATH = getArgValue("--output");

const MAX_MEAN_AXIS_DELTA = Number.parseFloat(getArgValue("--max-mean-axis-delta") ?? "");
const MAX_AXIS_DELTA = Number.parseFloat(getArgValue("--max-axis-delta") ?? "");

const PASS_MODE_OVERRIDE = getArgValue("--pass-mode");
const CORE_MODEL_OVERRIDE = getArgValue("--core-model");
const ADV_AUDIO_OVERRIDE = getArgValue("--adv-audio-model");
const ADV_VISUAL_OVERRIDE = getArgValue("--adv-visual-model");
const SALVAGE_OVERRIDE = getArgValue("--salvage-model");

const axisKeys: Array<keyof MetaAxes> = [
  "voiceIntensity",
  "conceptualDepth",
  "narrativeStructureStrength",
  "visualDynamism",
  "productionPolish",
];

const secondOrderKeys = [
  "alignmentScore",
  "balanceScore",
  "timingScore",
  "driftScore",
  "decayScore",
] as const;

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const isObservedMetric = (metric?: ScoredMetric) =>
  metric?.observed === true || (typeof metric?.score === "number" && metric.score > 0);

const parseBaseline = (fingerprintText?: string | null): VideoFingerprintJson | null => {
  if (!fingerprintText) return null;
  try {
    return validateFingerprint(JSON.parse(fingerprintText));
  } catch {
    return null;
  }
};

const matchesFilter = (
  ref: {
    id: string;
    displayName: string;
    channelId?: string | null;
    analyses: Array<{ youtubeVideoId: string }>;
  },
  filters: string[],
) => {
  if (!filters.length) return true;
  const latestVideoId = ref.analyses[0]?.youtubeVideoId;
  const candidates = [ref.id, ref.displayName, ref.channelId, latestVideoId]
    .filter(Boolean)
    .map((value) => value.toLowerCase());
  return candidates.some((candidate) => filters.includes(candidate));
};

async function main() {
  if (!ALLOW_DRIFT) {
    console.error("Set ALLOW_REFERENCE_DRIFT=true to run this script.");
    process.exit(1);
  }

  const config = getAppConfig();
  if (config.analysisMode !== "gemini") {
    console.error("This script requires ANALYSIS_MODE=gemini and valid Gemini/YouTube keys.");
    process.exit(1);
  }

  const effectiveConfig = {
    ...config,
    geminiMultimodalCoreModel: CORE_MODEL_OVERRIDE ?? config.geminiMultimodalCoreModel,
    geminiMultimodalAdvancedAudioModel: ADV_AUDIO_OVERRIDE ?? config.geminiMultimodalAdvancedAudioModel,
    geminiMultimodalAdvancedVisualModel: ADV_VISUAL_OVERRIDE ?? config.geminiMultimodalAdvancedVisualModel,
    geminiMultimodalSalvageModel: SALVAGE_OVERRIDE ?? config.geminiMultimodalSalvageModel,
  };

  if (PASS_MODE_OVERRIDE === "core") {
    effectiveConfig.multimodalPassMode = "core";
    effectiveConfig.advancedMetricsEnabled = false;
  } else if (PASS_MODE_OVERRIDE === "full") {
    effectiveConfig.multimodalPassMode = "full";
    effectiveConfig.advancedMetricsEnabled = true;
  }

  const references = await prisma.creatorProfile.findMany({
    where: { type: "reference" },
    include: {
      analyses: {
        orderBy: { createdAt: "desc" },
        include: { videoFingerprint: true },
      },
    },
  });

  let filtered = references.filter((ref) => matchesFilter(ref, ONLY_FILTERS));
  if (Number.isFinite(LIMIT)) {
    filtered = filtered.slice(0, LIMIT);
  }

  if (!filtered.length) {
    console.log("No reference creators matched the current filters.");
    return;
  }

  const axisDeltaPool: number[] = [];
  const distancePool: number[] = [];
  const secondOrderPool: number[] = [];

  const report = {
    startedAt: new Date().toISOString(),
    options: {
      only: ONLY_FILTERS,
      limit: Number.isFinite(LIMIT) ? LIMIT : undefined,
      maxMeanAxisDelta: Number.isFinite(MAX_MEAN_AXIS_DELTA) ? MAX_MEAN_AXIS_DELTA : undefined,
      maxAxisDelta: Number.isFinite(MAX_AXIS_DELTA) ? MAX_AXIS_DELTA : undefined,
    },
    config: {
      analysisMode: effectiveConfig.analysisMode,
      analysisVersion: effectiveConfig.analysisVersion,
      multimodalPassMode: effectiveConfig.multimodalPassMode,
      models: {
        core: effectiveConfig.geminiMultimodalCoreModel,
        advancedAudio: effectiveConfig.geminiMultimodalAdvancedAudioModel,
        advancedVisual: effectiveConfig.geminiMultimodalAdvancedVisualModel,
        salvage: effectiveConfig.geminiMultimodalSalvageModel,
      },
    },
    summary: {
      total: filtered.length,
      analyzed: 0,
      skipped: 0,
      failed: 0,
      meanAbsAxisDelta: null as number | null,
      maxAbsAxisDelta: null as number | null,
      meanDistance: null as number | null,
      maxDistance: null as number | null,
      meanSecondOrderDelta: null as number | null,
      maxSecondOrderDelta: null as number | null,
    },
    references: [] as Array<{
      creatorId: string;
      displayName: string;
      youtubeVideoId?: string;
      status: "analyzed" | "skipped" | "failed";
      reason?: string;
      drift?: {
        distance: number;
        meanAbsAxisDelta: number;
        maxAbsAxisDelta: number;
        axisDeltas: Record<string, { baseline: number; candidate: number; delta: number; absDelta: number }>;
        meanSecondOrderDelta?: number | null;
        maxSecondOrderDelta?: number | null;
      };
    }>,
  };

  for (const ref of filtered) {
    const analysis = ref.analyses[0];
    if (!analysis) {
      report.summary.skipped += 1;
      report.references.push({
        creatorId: ref.id,
        displayName: ref.displayName,
        status: "skipped",
        reason: "missing-analysis",
      });
      continue;
    }

    const baseline = parseBaseline(analysis.videoFingerprint?.fingerprint);
    if (!baseline) {
      report.summary.skipped += 1;
      report.references.push({
        creatorId: ref.id,
        displayName: ref.displayName,
        youtubeVideoId: analysis.youtubeVideoId,
        status: "skipped",
        reason: "missing-fingerprint",
      });
      continue;
    }

    console.log(`Analyzing candidate for drift: ${ref.displayName} (${analysis.youtubeVideoId})`);

    try {
      const result = await analyzeVideo(
        {
          videoId: analysis.youtubeVideoId,
          title: analysis.title ?? "Reference video",
          durationSeconds: analysis.durationSeconds,
          creatorDisplayName: ref.displayName,
          channelId: ref.channelId ?? undefined,
        },
        { config: effectiveConfig },
      );

      const candidate = validateFingerprint(result.fingerprint);
      const axisDeltas = axisKeys.reduce(
        (acc, key) => {
          const baselineValue = baseline.metaAxes[key];
          const candidateValue = candidate.metaAxes[key];
          const delta = candidateValue - baselineValue;
          const absDelta = Math.abs(delta);
          acc[key] = { baseline: baselineValue, candidate: candidateValue, delta, absDelta };
          axisDeltaPool.push(absDelta);
          return acc;
        },
        {} as Record<string, { baseline: number; candidate: number; delta: number; absDelta: number }>,
      );

      const absAxisDeltas = axisKeys.map((key) => axisDeltas[key]?.absDelta ?? 0);
      const meanAbsAxisDelta = average(absAxisDeltas);
      const maxAbsAxisDelta = Math.max(...absAxisDeltas);
      const distance = distanceOnMetaAxes(baseline.metaAxes, candidate.metaAxes, {
        targetFingerprint: baseline,
        candidateFingerprint: candidate,
      });

      distancePool.push(distance);

      const secondOrderDeltas = secondOrderKeys
        .map((key) => {
          const baselineMetric = baseline.secondOrder?.[key];
          const candidateMetric = candidate.secondOrder?.[key];
          if (!isObservedMetric(baselineMetric) || !isObservedMetric(candidateMetric)) return null;
          return Math.abs((candidateMetric?.score ?? 0) - (baselineMetric?.score ?? 0));
        })
        .filter((value): value is number => value !== null);

      if (secondOrderDeltas.length) {
        secondOrderPool.push(...secondOrderDeltas);
      }

      report.summary.analyzed += 1;
      report.references.push({
        creatorId: ref.id,
        displayName: ref.displayName,
        youtubeVideoId: analysis.youtubeVideoId,
        status: "analyzed",
        drift: {
          distance,
          meanAbsAxisDelta,
          maxAbsAxisDelta,
          axisDeltas,
          meanSecondOrderDelta: secondOrderDeltas.length ? average(secondOrderDeltas) : null,
          maxSecondOrderDelta: secondOrderDeltas.length ? Math.max(...secondOrderDeltas) : null,
        },
      });
    } catch (error) {
      report.summary.failed += 1;
      report.references.push({
        creatorId: ref.id,
        displayName: ref.displayName,
        youtubeVideoId: analysis.youtubeVideoId,
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
      });
      console.error(`Failed drift run for ${ref.displayName}:`, error instanceof Error ? error.message : error);
    }
  }

  report.summary.meanAbsAxisDelta = axisDeltaPool.length ? average(axisDeltaPool) : null;
  report.summary.maxAbsAxisDelta = axisDeltaPool.length ? Math.max(...axisDeltaPool) : null;
  report.summary.meanDistance = distancePool.length ? average(distancePool) : null;
  report.summary.maxDistance = distancePool.length ? Math.max(...distancePool) : null;
  report.summary.meanSecondOrderDelta = secondOrderPool.length ? average(secondOrderPool) : null;
  report.summary.maxSecondOrderDelta = secondOrderPool.length ? Math.max(...secondOrderPool) : null;

  if (OUTPUT_PATH) {
    const resolved = path.resolve(process.cwd(), OUTPUT_PATH);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, JSON.stringify(report, null, 2), "utf-8");
    console.log(`Wrote drift report to ${resolved}`);
  }

  console.log(
    `Drift summary: ${report.summary.analyzed} analyzed, ${report.summary.skipped} skipped, ${report.summary.failed} failed.`,
  );

  const thresholdFailures: string[] = [];
  if (Number.isFinite(MAX_MEAN_AXIS_DELTA) && (report.summary.meanAbsAxisDelta ?? 0) > MAX_MEAN_AXIS_DELTA) {
    thresholdFailures.push(
      `meanAbsAxisDelta ${report.summary.meanAbsAxisDelta?.toFixed(2)} > ${MAX_MEAN_AXIS_DELTA}`,
    );
  }
  if (Number.isFinite(MAX_AXIS_DELTA) && (report.summary.maxAbsAxisDelta ?? 0) > MAX_AXIS_DELTA) {
    thresholdFailures.push(
      `maxAbsAxisDelta ${report.summary.maxAbsAxisDelta?.toFixed(2)} > ${MAX_AXIS_DELTA}`,
    );
  }

  if (thresholdFailures.length) {
    console.error(`Drift thresholds exceeded: ${thresholdFailures.join("; ")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Drift script failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
