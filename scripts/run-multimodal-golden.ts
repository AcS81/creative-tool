import { analyzeVideoMultimodal } from "../src/lib/analysis/geminiMultimodalAnalyzer";
import { buildVideoFingerprint, computeMetaAxesFromProfiles } from "../src/lib/analysis/fingerprint/videoFingerprint";
import type { AppConfig } from "../src/lib/config";
import type { FingerprintPerDomain } from "../src/lib/types/fingerprint";

type GoldenVideo = {
  id: string;
  url: string;
  notes: string;
  expected: {
    story: "low" | "medium" | "high";
    music: "none" | "light" | "heavy";
    pacing: "slow" | "medium" | "fast";
  };
};

const goldenSet: GoldenVideo[] = [
  {
    id: "A",
    url: "https://www.youtube.com/watch?v=2b6KuoWZ6n0",
    notes: "Strong story arc, minimal music",
    expected: { story: "high", music: "none", pacing: "medium" },
  },
  {
    id: "B",
    url: "https://www.youtube.com/watch?v=JGwWNGJdvx8",
    notes: "Heavy music bed, weak narrative",
    expected: { story: "low", music: "heavy", pacing: "medium" },
  },
  {
    id: "C",
    url: "https://www.youtube.com/watch?v=QwZT7T-TXT0",
    notes: "Fast-cut commentary with pattern interrupts",
    expected: { story: "low", music: "light", pacing: "fast" },
  },
  {
    id: "D",
    url: "https://www.youtube.com/watch?v=Ke90Tje7VS0",
    notes: "Tutorial with screenshare and light music",
    expected: { story: "medium", music: "light", pacing: "medium" },
  },
  {
    id: "E",
    url: "https://www.youtube.com/watch?v=GPeeZ6viNgY",
    notes: "Vlog with multiple setups and music stings",
    expected: { story: "medium", music: "light", pacing: "medium" },
  },
];

const getScore = (domain: keyof ReturnType<typeof computeMetaAxesFromProfiles> | string, axis: string, axisDetails?: Record<string, { rawValue?: string }>) => {
  const key = axis.includes(".") ? axis : `${domain}.${axis}`;
  return axisDetails?.[key];
};

const summarize = (video: GoldenVideo, axisDetails?: Record<string, { rawValue?: string; observed?: boolean }>) => {
  const music = getScore("sound", "music_coverage", axisDetails)?.rawValue || "n/a";
  const musicChanges = getScore("sound", "music_changes", axisDetails)?.rawValue || "n/a";
  const cutRate = getScore("editing", "cut_rate", axisDetails)?.rawValue || "n/a";
  const story = getScore("narrative", "story_presence", axisDetails)?.rawValue || "n/a";
  return {
    musicCoverage: music,
    musicChanges,
    cutRate,
    storyPresence: story,
    expected: video.expected,
  };
};

async function run() {
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
    console.log(`\n=== Video ${video.id}: ${video.url}`);
    console.log(`Notes: ${video.notes}`);
    const start = Date.now();
    try {
      const analysis = await analyzeVideoMultimodal({ youtubeUrl: video.url, config });
    const perDomain = toFingerprintDomains(analysis.profiles);
    const fingerprint = buildVideoFingerprint(perDomain, {
      metaAxes: computeMetaAxesFromProfiles(perDomain),
        supporting: { beats: analysis.beats, axisDetails: analysis.axisDetails },
      });
      const summary = summarize(video, fingerprint.supporting?.axisDetails);
      console.log(
        `Status: ok (fallback=${analysis.diagnostics.fromFallback ? "yes" : "no"}) ` +
          `unobserved=${JSON.stringify(analysis.diagnostics.unobservedCounts)}`,
      );
      console.log(
        `Sound -> musicCoverage: ${summary.musicCoverage}, musicChanges: ${summary.musicChanges}; ` +
          `Editing -> cutRate: ${summary.cutRate}; Narrative -> storyPresence: ${summary.storyPresence}`,
      );
      console.log(
        `Expected -> story: ${video.expected.story}, music: ${video.expected.music}, pacing: ${video.expected.pacing}`,
      );
    } catch (error) {
      console.error(`Failed for ${video.url}:`, error instanceof Error ? error.message : String(error));
    } finally {
      console.log(`Duration: ${Date.now() - start} ms`);
    }
  }
}

run().catch((error) => {
  console.error("Golden set runner failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
