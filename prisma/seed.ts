import { PrismaClient } from "@prisma/client";
import { validateFingerprint } from "../src/lib/schemas/fingerprint";
import { buildVideoFingerprint } from "../src/lib/analysis/fingerprint/videoFingerprint";
import { buildMockAdvancedMetrics, hashStringToNumber } from "../src/lib/analysis/fingerprint/mockAdvancedMetrics";
import { getAxesForDomain, resolveAxisMetadata } from "../src/lib/analysis/axisMetadata";

const prisma = new PrismaClient();
// Seeds default to deterministic mocks; run the refresh script with Gemini keys (see docs/reference_seed_refresh.md) to replace them with observed metrics.

type DomainConfig = {
  base: number;
  archetype: string;
  summaryText: string;
  highlights?: string[];
};

type SeedCreator = {
  key: string;
  displayName: string;
  channelId: string;
  youtubeVideoId: string;
  title: string;
  durationSeconds: number;
  metaAxes: {
    voiceIntensity: number;
    conceptualDepth: number;
    narrativeStructureStrength: number;
    visualDynamism: number;
    productionPolish: number;
  };
  domains: {
    voice: DomainConfig;
    language: DomainConfig;
    narrative: DomainConfig;
    visual: DomainConfig;
    editing: DomainConfig;
    sound: DomainConfig;
  };
};

const referenceCreators: SeedCreator[] = [
  {
    key: "high-energy-commentator",
    displayName: "High-Energy Commentator",
    channelId: "ref-high-energy",
    youtubeVideoId: "vid-high-energy",
    title: "High Energy Breakdown",
    durationSeconds: 720,
    metaAxes: {
      voiceIntensity: 82,
      conceptualDepth: 52,
      narrativeStructureStrength: 60,
      visualDynamism: 74,
      productionPolish: 68,
    },
    domains: {
      voice: {
        base: 80,
        archetype: "Hyperactive Commentator",
        summaryText: "Fast-paced delivery with sharp emphasis and frequent resets to keep attention high.",
      },
      language: {
        base: 55,
        archetype: "Concise Commentator",
        summaryText: "Short, punchy phrasing that favors takes and reactions over long exposition.",
      },
      narrative: {
        base: 60,
        archetype: "Segmented Explainer",
        summaryText: "Moves through quick beats with mini-hooks every few minutes.",
      },
      visual: {
        base: 70,
        archetype: "Dynamic Desk Setup",
        summaryText: "Constant framing tweaks and hand movement keep the scene lively.",
      },
      editing: {
        base: 78,
        archetype: "Cut-Heavy Pacing",
        summaryText: "Frequent jump cuts and pattern interrupts to maintain speed.",
      },
      sound: {
        base: 62,
        archetype: "Upbeat Underscore",
        summaryText: "Light music bed that lifts energy without overpowering voice.",
      },
    },
  },
  {
    key: "calm-storyteller",
    displayName: "Calm Storyteller",
    channelId: "ref-calm-story",
    youtubeVideoId: "vid-calm-story",
    title: "Slow Burn Narrative",
    durationSeconds: 900,
    metaAxes: {
      voiceIntensity: 52,
      conceptualDepth: 64,
      narrativeStructureStrength: 72,
      visualDynamism: 48,
      productionPolish: 58,
    },
    domains: {
      voice: {
        base: 50,
        archetype: "Warm Narrator",
        summaryText: "Measured pace with gentle cadence and low filler.",
      },
      language: {
        base: 66,
        archetype: "Reflective Essayist",
        summaryText: "Balances concrete detail with introspective framing.",
      },
      narrative: {
        base: 76,
        archetype: "Arc-Driven Storyteller",
        summaryText: "Builds setups and payoffs with clear act breaks.",
      },
      visual: {
        base: 46,
        archetype: "Stable Frame",
        summaryText: "Minimal camera movement; relies on presence and props.",
      },
      editing: {
        base: 55,
        archetype: "Measured Cuts",
        summaryText: "Longer takes with purposeful trims at beat changes.",
      },
      sound: {
        base: 50,
        archetype: "Subtle Underscore",
        summaryText: "Sparse music used only to mark transitions.",
      },
    },
  },
  {
    key: "polished-analyst",
    displayName: "Polished Analyst",
    channelId: "ref-polished-analyst",
    youtubeVideoId: "vid-polished-analyst",
    title: "Deep Dive Analysis",
    durationSeconds: 840,
    metaAxes: {
      voiceIntensity: 68,
      conceptualDepth: 78,
      narrativeStructureStrength: 70,
      visualDynamism: 60,
      productionPolish: 82,
    },
    domains: {
      voice: {
        base: 66,
        archetype: "Measured Host",
        summaryText: "Clear articulation with confident pacing and controlled emphasis.",
      },
      language: {
        base: 78,
        archetype: "Analytical Explainer",
        summaryText: "Dense with insights, examples, and structured argumentation.",
      },
      narrative: {
        base: 72,
        archetype: "Structured Deep Dive",
        summaryText: "Outlines, defends, and recaps with clean section markers.",
      },
      visual: {
        base: 58,
        archetype: "Composed Studio",
        summaryText: "Steady framing with occasional illustrative overlays.",
      },
      editing: {
        base: 80,
        archetype: "Polished Post",
        summaryText: "Tight cuts, subtle motion graphics, and minimal dead air.",
      },
      sound: {
        base: 64,
        archetype: "Balanced Mix",
        summaryText: "Voice-forward mix with restrained music and light SFX.",
      },
    },
  },
];

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const canonicalScores = (domain: keyof SeedCreator["domains"], base: number) => {
  const axes = getAxesForDomain(domain as any)
    .filter((axis) => axis.id.includes("."))
    .slice(0, 5);
  return axes.map((axis, idx) => ({
    key: axis.id,
    label: axis.label,
    value: clamp(base + idx * 2 - 2),
  }));
};

const makeDomain = (config: DomainConfig, domainKey: keyof SeedCreator["domains"]) => {
  const scores = canonicalScores(domainKey, config.base);
  return {
    primaryArchetype: config.archetype,
    summaryText: config.summaryText,
    scores,
    highlights: config.highlights ?? [`Notable ${domainKey} trait`],
    axisDetails: scores.reduce<Record<string, { rawValue: string; explanation?: string; observed?: boolean }>>(
      (acc, score) => {
        const meta = resolveAxisMetadata(score.key);
        acc[score.key] = { rawValue: `${score.value}`, explanation: meta?.shortDescription, observed: true };
        return acc;
      },
      {},
    ),
  };
};

const makeFingerprint = (seed: SeedCreator) => {
  const perDomain = {
    voiceProfile: makeDomain(seed.domains.voice, "voice"),
    languageProfile: makeDomain(seed.domains.language, "language"),
    narrativeProfile: makeDomain(seed.domains.narrative, "narrative"),
    visualProfile: makeDomain(seed.domains.visual, "visual"),
    editingProfile: makeDomain(seed.domains.editing, "editing"),
    soundProfile: makeDomain(seed.domains.sound, "sound"),
  };

  const fingerprint = buildVideoFingerprint(perDomain, {
    metaAxes: seed.metaAxes,
    overallArchetype: seed.displayName,
    version: "1.3.0",
    advancedMetrics: buildMockAdvancedMetrics(hashStringToNumber(seed.youtubeVideoId)),
  });

  return validateFingerprint(fingerprint);
};

async function seedReferenceCreator(seed: SeedCreator, index: number) {
  const fingerprint = makeFingerprint(seed);

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
