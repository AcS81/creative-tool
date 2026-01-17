import { callGeminiMultimodalJson } from "../src/lib/gemini/client";
import {
  multimodalPrompt,
  multimodalResponseJsonSchema,
  multimodalSystemInstruction,
} from "../src/lib/analysis/geminiMultimodalAnalyzer";
import { parseGeminiMultimodalJson } from "../src/lib/analysis/validators/geminiMultimodal";
import type { AppConfig } from "../src/lib/config";
import { isValidYouTubeUrl } from "../src/lib/youtube";

type CliArgs = {
  url: string;
  skipGemini: boolean;
};

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  const urlFlagIndex = args.findIndex((arg) => arg === "--url");
  const url = (urlFlagIndex >= 0 ? args[urlFlagIndex + 1] : undefined) || process.env.YOUTUBE_URL || "";

  return {
    url,
    skipGemini: args.includes("--skip-gemini"),
  };
};

const warnMissingUrl = () => {
  console.error("Usage: tsx scripts/probe-multimodal-ingestion.ts --url <youtube-url> [--skip-gemini]");
  process.exit(1);
};

const summarizeUnobserved = (domain: unknown) => {
  const entries = Object.values(domain as Record<string, { score: number; value: string }>);
  return entries.filter((metric) => metric.value === "unobserved" || metric.score === 0).length;
};

const summarizeGeminiResponse = (raw: unknown) => {
  const parsed = parseGeminiMultimodalJson(raw);
  const unobserved = {
    voice: summarizeUnobserved(parsed.voice),
    language: summarizeUnobserved(parsed.language),
    narrative: summarizeUnobserved(parsed.narrative),
    visual_edit_sound: summarizeUnobserved(parsed.visual_edit_sound),
  };

  return {
    parsed,
    unobserved,
    highlights: {
      beats: parsed.narrative.beats.length,
      speakingRate: parsed.voice.speaking_rate.value,
      cutRate: parsed.visual_edit_sound.cut_rate.value,
      music: parsed.visual_edit_sound.music_changes.value,
      talkingVsBroll: parsed.visual_edit_sound.talking_vs_broll_vs_graphics.value,
    },
  };
};

async function main() {
  const args = parseArgs();
  if (!args.url) {
    warnMissingUrl();
  }

  if (!isValidYouTubeUrl(args.url)) {
    console.error(`Invalid YouTube URL: ${args.url}`);
    process.exit(1);
  }

  if (args.skipGemini) {
    console.log("Skipping Gemini call (requested via --skip-gemini).");
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY not set; skipping Gemini call. Export GEMINI_API_KEY to run the multimodal request.");
    return;
  }

  const config: AppConfig = {
    analysisMode: "mock",
    analysisVersion: "v2",
    analysisV2MultimodalEnabled: true,
    geminiApiKey: process.env.GEMINI_API_KEY,
    youtubeApiKey: process.env.YOUTUBE_API_KEY ?? "unused",
    performanceEnabled: false,
    advancedMetricsEnabled: true,
    structurePassEnabled: true,
    structurePassTimeoutMs: 30000,
  };

  console.log("=== Gemini multimodal call (URL-only ingestion) ===");
  const result = await callGeminiMultimodalJson({
    youtubeUrl: args.url,
    prompt: multimodalPrompt,
    jsonSchema: multimodalResponseJsonSchema,
    systemInstruction: multimodalSystemInstruction,
    config,
    forceEnable: true,
  });

  if (!result.ok) {
    console.error(`Gemini call failed [${result.errorCode}]: ${result.errorMessage}`);
    if (result.status) {
      console.error(`HTTP status: ${result.status}`);
    }
    return;
  }

  const { parsed, unobserved, highlights } = summarizeGeminiResponse(result.rawJson);
  console.log(`Gemini OK (status ${result.status}) via URL ingestion; unobserved counts:`, unobserved);
  console.log("Highlights:", highlights);
  console.log("First two beats:", parsed.narrative.beats.slice(0, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Probe failed:", message);
  process.exit(1);
});
