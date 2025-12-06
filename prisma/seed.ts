import { PrismaClient } from "@prisma/client";
import { validateFingerprint } from "../src/lib/schemas/fingerprint";

const prisma = new PrismaClient();

type SeedCreator = {
  key: string;
  displayName: string;
  channelId: string;
  youtubeVideoId: string;
  title: string;
  durationSeconds: number;
};

const referenceCreators: SeedCreator[] = [
  {
    key: "high-energy-commentator",
    displayName: "High-Energy Commentator",
    channelId: "ref-high-energy",
    youtubeVideoId: "vid-high-energy",
    title: "High Energy Breakdown",
    durationSeconds: 720,
  },
  {
    key: "calm-storyteller",
    displayName: "Calm Storyteller",
    channelId: "ref-calm-story",
    youtubeVideoId: "vid-calm-story",
    title: "Slow Burn Narrative",
    durationSeconds: 900,
  },
  {
    key: "polished-analyst",
    displayName: "Polished Analyst",
    channelId: "ref-polished-analyst",
    youtubeVideoId: "vid-polished-analyst",
    title: "Deep Dive Analysis",
    durationSeconds: 840,
  },
];

const makeDomain = (label: string, value: number) => ({
  primaryArchetype: `${label} Archetype`,
  summaryText: `${label} summary`,
  scores: [
    {
      key: `${label.toLowerCase()}-axis`,
      label: `${label} Axis`,
      value,
    },
  ],
  highlights: [`Notable ${label.toLowerCase()} trait`],
});

const makeFingerprint = (seed: SeedCreator, base: number) => {
  const fingerprint = {
    version: "1.1.0" as const,
    createdAt: new Date().toISOString(),
    metaAxes: {
      voiceIntensity: 60 + base,
      conceptualDepth: 55 + base,
      narrativeStructureStrength: 58 + base,
      visualDynamism: 50 + base,
      productionPolish: 62 + base,
    },
    perDomain: {
      voiceProfile: makeDomain("Voice", 60 + base),
      languageProfile: makeDomain("Language", 55 + base),
      narrativeProfile: makeDomain("Narrative", 58 + base),
      visualProfile: makeDomain("Visual", 50 + base),
      editingProfile: makeDomain("Editing", 62 + base),
      soundProfile: makeDomain("Sound", 54 + base),
    },
    overallArchetype: seed.displayName,
  };

  return validateFingerprint(fingerprint);
};

async function seedReferenceCreator(seed: SeedCreator, index: number) {
  const fingerprint = makeFingerprint(seed, index * 5);

  const creator = await prisma.creatorProfile.upsert({
    where: { channelId: seed.channelId },
    create: {
      id: seed.key,
      type: "reference",
      displayName: seed.displayName,
      channelId: seed.channelId,
      analyses: {
        create: {
          id: `${seed.key}-analysis`,
          youtubeVideoId: seed.youtubeVideoId,
          title: seed.title,
          durationSeconds: seed.durationSeconds,
          status: "complete",
          videoFingerprint: {
            create: {
              id: `${seed.key}-fingerprint`,
              fingerprint: JSON.stringify(fingerprint),
            },
          },
        },
      },
    },
    update: {
      displayName: seed.displayName,
      type: "reference",
    },
    include: { analyses: true },
  });

  // Ensure fingerprint exists/updated for the upserted analysis
  const analysisId = creator.analyses[0]?.id ?? `${seed.key}-analysis`;
  await prisma.videoFingerprint.upsert({
    where: { videoAnalysisId: analysisId },
    create: {
      id: `${seed.key}-fingerprint`,
      videoAnalysisId: analysisId,
      fingerprint: JSON.stringify(fingerprint),
    },
    update: {
      fingerprint: JSON.stringify(fingerprint),
    },
  });
}

async function main() {
  for (const [index, seed] of referenceCreators.entries()) {
    await seedReferenceCreator(seed, index);
  }
  console.log(`Seeded ${referenceCreators.length} reference creators with fingerprints.`);
}

main()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
