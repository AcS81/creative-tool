import { Buffer } from "node:buffer";
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
  forceFallback: boolean;
  skipGemini: boolean;
  sampleBytes: number;
};

const DEFAULT_SAMPLE_BYTES = 2048;

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  const urlFlagIndex = args.findIndex((arg) => arg === "--url");
  const url = (urlFlagIndex >= 0 ? args[urlFlagIndex + 1] : undefined) || process.env.YOUTUBE_URL || "";

  return {
    url,
    forceFallback: args.includes("--force-fallback"),
    skipGemini: args.includes("--skip-gemini"),
    sampleBytes: (() => {
      const idx = args.findIndex((arg) => arg === "--bytes");
      if (idx >= 0) {
        const parsed = Number.parseInt(args[idx + 1], 10);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
      return DEFAULT_SAMPLE_BYTES;
    })(),
  };
};

const looksLikeHtml = (preview: string) => {
  const lower = preview.toLowerCase();
  return lower.includes("<!doctype html") || lower.includes("<html");
};

const probeFallbackSample = async (youtubeUrl: string, maxBytes: number) => {
  const response = await fetch(youtubeUrl, {
    headers: { Range: `bytes=0-${maxBytes - 1}` },
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  const preview = buffer.subarray(0, Math.min(buffer.length, 200)).toString("utf8");

  return {
    status: response.status,
    contentType: response.headers.get("content-type") || "unknown",
    byteLength: buffer.byteLength,
    preview,
    looksLikeHtml: looksLikeHtml(preview),
  };
};

const warnMissingUrl = () => {
  console.error("Usage: tsx scripts/probe-multimodal-ingestion.ts --url <youtube-url> [--force-fallback] [--skip-gemini] [--bytes N]");
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

  console.log("=== Fallback download probe (Range request) ===");
  try {
    const sample = await probeFallbackSample(args.url, args.sampleBytes);
    console.log(
      `Status ${sample.status}, content-type ${sample.contentType}, bytes ${sample.byteLength}, looksLikeHtml=${sample.looksLikeHtml}`,
    );
    console.log(`Preview: ${sample.preview.replace(/\s+/g, " ").slice(0, 140)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Fallback probe failed:", message);
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
  };

  console.log(`=== Gemini multimodal call (forceFallback=${args.forceFallback ? "true" : "false"}) ===`);
  const result = await callGeminiMultimodalJson({
    youtubeUrl: args.url,
    prompt: multimodalPrompt,
    jsonSchema: multimodalResponseJsonSchema,
    systemInstruction: multimodalSystemInstruction,
    config,
    forceEnable: true,
    forceFallback: args.forceFallback,
  });

  if (!result.ok) {
    console.error(`Gemini call failed [${result.errorCode}]: ${result.errorMessage}`);
    if (result.status) {
      console.error(`HTTP status: ${result.status}`);
    }
    return;
  }

  const { parsed, unobserved, highlights } = summarizeGeminiResponse(result.rawJson);
  console.log(
    `Gemini OK (status ${result.status}) via ${result.fromFallback ? "fallback inline_data" : "file_data"}; unobserved counts:`,
    unobserved,
  );
  console.log("Highlights:", highlights);
  console.log("First two beats:", parsed.narrative.beats.slice(0, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Probe failed:", message);
  process.exit(1);
});
