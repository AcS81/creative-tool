import prisma from "../src/lib/db";
import { getAppConfig } from "../src/lib/config";
import { analyzeVideo } from "../src/lib/analysis/service";
import { validateFingerprint } from "../src/lib/schemas/fingerprint";

const DRY_RUN = process.argv.includes("--dry-run");
const ALLOW_REFRESH = process.env.ALLOW_REFERENCE_REFRESH === "true";

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

  for (const ref of references) {
    const analysis = ref.analyses[0];
    if (!analysis) {
      console.warn(`Skipping ${ref.displayName}: no analysis record found.`);
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
    } catch (error) {
      console.error(`Failed to refresh ${ref.displayName}:`, error instanceof Error ? error.message : error);
    }
  }
}

main()
  .catch((error) => {
    console.error("Refresh script failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
