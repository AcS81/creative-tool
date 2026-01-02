import fs from "node:fs";
import path from "node:path";
import prisma from "../src/lib/db";
import { getAppConfig } from "../src/lib/config";
import { analyzeVideo } from "../src/lib/analysis/service";
import { validateFingerprint } from "../src/lib/schemas/fingerprint";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ALLOW_REFRESH = process.env.ALLOW_REFERENCE_REFRESH === "true";

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
const staleDaysArg = getArgValue("--stale-days");
const STALE_DAYS = staleDaysArg ? Number.parseFloat(staleDaysArg) : undefined;
const OUTPUT_PATH = getArgValue("--output");
const DAY_MS = 24 * 60 * 60 * 1000;

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
  if (!ALLOW_REFRESH) {
    console.error("Set ALLOW_REFERENCE_REFRESH=true to run this script.");
    process.exit(1);
  }

  const config = getAppConfig();
  if (config.analysisMode !== "gemini") {
    console.error("This script requires ANALYSIS_MODE=gemini and valid Gemini/YouTube keys.");
    process.exit(1);
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

  const report = {
    startedAt: new Date().toISOString(),
    options: {
      dryRun: DRY_RUN,
      only: ONLY_FILTERS,
      limit: Number.isFinite(LIMIT) ? LIMIT : undefined,
      staleDays: Number.isFinite(STALE_DAYS) ? STALE_DAYS : undefined,
    },
    config: {
      analysisMode: config.analysisMode,
      analysisVersion: config.analysisVersion,
      multimodalPassMode: config.multimodalPassMode,
      models: {
        core: config.geminiMultimodalCoreModel,
        advancedAudio: config.geminiMultimodalAdvancedAudioModel,
        advancedVisual: config.geminiMultimodalAdvancedVisualModel,
        salvage: config.geminiMultimodalSalvageModel,
      },
    },
    summary: {
      total: filtered.length,
      refreshed: 0,
      skipped: 0,
      failed: 0,
    },
    references: [] as Array<{
      creatorId: string;
      displayName: string;
      youtubeVideoId?: string;
      status: "updated" | "skipped" | "failed" | "dry-run";
      reason?: string;
      fingerprintVersion?: string;
    }>,
  };

  const isStale = (updatedAt?: Date | null) => {
    if (!Number.isFinite(STALE_DAYS)) return true;
    if (!updatedAt) return true;
    return Date.now() - updatedAt.getTime() >= (STALE_DAYS ?? 0) * DAY_MS;
  };

  for (const ref of filtered) {
    const analysis = ref.analyses[0];
    if (!analysis) {
      console.warn(`Skipping ${ref.displayName}: no analysis record found.`);
      report.summary.skipped += 1;
      report.references.push({
        creatorId: ref.id,
        displayName: ref.displayName,
        status: "skipped",
        reason: "missing-analysis",
      });
      continue;
    }

    if (!isStale(analysis.updatedAt ?? analysis.createdAt)) {
      console.log(`Skipping ${ref.displayName}: refreshed within ${STALE_DAYS} days.`);
      report.summary.skipped += 1;
      report.references.push({
        creatorId: ref.id,
        displayName: ref.displayName,
        youtubeVideoId: analysis.youtubeVideoId,
        status: "skipped",
        reason: "fresh",
      });
      continue;
    }

    console.log(`Re-analyzing reference: ${ref.displayName} (${analysis.youtubeVideoId})`);
    try {
      const result = await analyzeVideo(
        {
          videoId: analysis.youtubeVideoId,
          title: analysis.title ?? "Reference video",
          durationSeconds: analysis.durationSeconds,
          creatorDisplayName: ref.displayName,
          channelId: ref.channelId ?? undefined,
        },
        { config },
      );

      const fingerprint = validateFingerprint(result.fingerprint);

      if (DRY_RUN) {
        console.log(
          `DRY RUN: would update fingerprint for ${ref.displayName} with version ${fingerprint.version}`,
        );
        report.summary.refreshed += 1;
        report.references.push({
          creatorId: ref.id,
          displayName: ref.displayName,
          youtubeVideoId: analysis.youtubeVideoId,
          status: "dry-run",
          fingerprintVersion: fingerprint.version,
        });
        continue;
      }

      await prisma.videoAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: "complete",
          failureReason: null,
          title: result.overallArchetype || analysis.title,
        },
      });

      await prisma.videoFingerprint.upsert({
        where: { videoAnalysisId: analysis.id },
        create: {
          videoAnalysisId: analysis.id,
          fingerprint: JSON.stringify(fingerprint),
        },
        update: {
          fingerprint: JSON.stringify(fingerprint),
        },
      });

      console.log(`Updated fingerprint for ${ref.displayName}`);
      report.summary.refreshed += 1;
      report.references.push({
        creatorId: ref.id,
        displayName: ref.displayName,
        youtubeVideoId: analysis.youtubeVideoId,
        status: "updated",
        fingerprintVersion: fingerprint.version,
      });
    } catch (error) {
      console.error(`Failed to refresh ${ref.displayName}:`, error instanceof Error ? error.message : error);
      report.summary.failed += 1;
      report.references.push({
        creatorId: ref.id,
        displayName: ref.displayName,
        youtubeVideoId: analysis.youtubeVideoId,
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (OUTPUT_PATH) {
    const resolved = path.resolve(process.cwd(), OUTPUT_PATH);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, JSON.stringify(report, null, 2), "utf-8");
    console.log(`Wrote refresh report to ${resolved}`);
  }

  console.log(
    `Refresh summary: ${report.summary.refreshed} refreshed, ${report.summary.skipped} skipped, ${report.summary.failed} failed.`,
  );
}

main()
  .catch((error) => {
    console.error("Refresh script failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
