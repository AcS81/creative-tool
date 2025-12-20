import { analyzeVideoMultimodal } from "../src/lib/analysis/geminiMultimodalAnalyzer";
import { buildVideoFingerprint, computeMetaAxesFromProfiles } from "../src/lib/analysis/fingerprint/videoFingerprint";
import type { AppConfig } from "../src/lib/config";
import type { FingerprintPerDomain } from "../src/lib/types/fingerprint";
import { buildDefaultAdvancedMetrics } from "../src/lib/analysis/fingerprint/defaults";

type GoldenExpectation = {
  story?: "low" | "medium" | "high";
  music?: "none" | "light" | "heavy";
  pacing?: "slow" | "medium" | "fast";
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

// Replace URLs with your canonical golden clips; script skips entries marked REPLACE_ME.
const defaultGoldenSet: GoldenVideo[] = [
  {
    id: "A",
    url: "https://www.youtube.com/watch?v=REPLACE_SPORTS_SHUSH",
    notes: "Sports highlight with crowd shush; should detect relative-energy silence spans near hooks/payoffs.",
    expected: { minSilenceSpans: 1, maxHookSeconds: 12, entropyTimelineRequired: true, cutTimelineRequired: true },
  },
  {
    id: "B",
    url: "https://www.youtube.com/watch?v=REPLACE_ESSAY_PAUSES",
    notes: "Essay/monologue with long pauses; strong silence spans, low cut pace.",
    expected: { minSilenceSpans: 2, maxHookSeconds: 20, entropyTimelineRequired: true, cutTimelineRequired: true },
  },
  {
    id: "C",
    url: "https://www.youtube.com/watch?v=REPLACE_HIGH_CUT_VLOG",
    notes: "High-cut vlog with heavy edits; entropy and cut timelines should be populated.",
    expected: { entropyTimelineRequired: true, cutTimelineRequired: true, maxHookSeconds: 15 },
  },
  {
    id: "D",
    url: "https://www.youtube.com/watch?v=REPLACE_QA_AUDIENCE",
    notes: "Q&A heavy talk; audience address frequency should be above threshold.",
    expected: { minAudienceAddresses: 3, maxHookSeconds: 18, entropyTimelineRequired: true },
  },
];

const loadGoldenSet = (): GoldenVideo[] => {
  const overridePath = process.env.GOLDEN_SET_PATH;
  if (!overridePath) return defaultGoldenSet;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const data = require(overridePath);
    if (Array.isArray(data)) return data as GoldenVideo[];
    console.warn(`GOLDEN_SET_PATH did not contain an array, using default set. (${overridePath})`);
    return defaultGoldenSet;
  } catch (error) {
    console.warn(`Failed to load GOLDEN_SET_PATH (${overridePath}), using default set.`, error);
    return defaultGoldenSet;
  }
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

const checkExpectations = (video: GoldenVideo, analysis: Awaited<ReturnType<typeof analyzeVideoMultimodal>>) => {
  const failures: string[] = [];
  const adv = analysis.advancedMetrics ?? buildDefaultAdvancedMetrics();
  const beats = analysis.beats ?? [];
  const firstHook = beats.find((b) => b.role === "hook") ?? beats[0];

  if (video.expected.maxHookSeconds) {
    const hookSeconds = firstHook?.startSeconds ?? toNumber(adv.narrativeArc.timeToHookSeconds.value);
    if (hookSeconds === undefined || hookSeconds > video.expected.maxHookSeconds) {
      failures.push(`hookSeconds=${hookSeconds ?? "unobserved"} > ${video.expected.maxHookSeconds}`);
    }
  }

  if (video.expected.minSilenceSpans) {
    const spans = adv.visualEditAlignment.silenceForEmphasisFidelity.spans ?? [];
    if (spans.length < video.expected.minSilenceSpans) {
      failures.push(`silence spans ${spans.length} < ${video.expected.minSilenceSpans}`);
    }
  }

  if (video.expected.minAudienceAddresses) {
    const counts = adv.languageTexture.audienceAddressFrequency.counts;
    const total = (counts?.direct ?? 0) + (counts?.rhetorical ?? 0);
    if (total < video.expected.minAudienceAddresses) {
      failures.push(`audience addresses ${total} < ${video.expected.minAudienceAddresses}`);
    }
  }

  if (video.expected.entropyTimelineRequired) {
    if (!adv.visualEditAlignment.visualEntropy.timeline?.length) {
      failures.push("missing visualEntropy timeline");
    }
  }

  if (video.expected.cutTimelineRequired) {
    if (!adv.visualEditAlignment.cutRateRefinement.timeline?.length) {
      failures.push("missing cutRateRefinement timeline");
    }
  }

  return failures;
};

async function run() {
  const goldenSet = loadGoldenSet();

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
  };

const toFingerprintDomains = (profiles: Awaited<ReturnType<typeof analyzeVideoMultimodal>>["profiles"]): FingerprintPerDomain => ({
  voiceProfile: profiles.voice,
  languageProfile: profiles.language,
  narrativeProfile: profiles.narrative,
  visualProfile: profiles.visual,
  editingProfile: profiles.editing,
  soundProfile: profiles.sound,
});

  for (const video of goldenSet) {
    if (!video.url || video.url.includes("REPLACE_")) {
      console.warn(`\n=== Video ${video.id}: skipped (url not set)`);
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
      console.log(
        `Status: ok (fallback=${analysis.diagnostics.fromFallback ? "yes" : "no"}) ` +
          `unobserved=${JSON.stringify(analysis.diagnostics.unobservedCounts)}`,
      );
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
        process.exitCode = 1;
      } else {
        console.log("Result: PASS");
      }
    } catch (error) {
      console.error(`Failed for ${video.url}:`, error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    } finally {
      console.log(`Duration: ${Date.now() - start} ms`);
    }
  }
}

run().catch((error) => {
  console.error("Golden set runner failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
