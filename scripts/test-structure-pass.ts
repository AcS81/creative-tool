#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import type { AppConfig } from "../src/lib/config";
import type {
  Chapter,
  KeyMoment,
  KeyMomentType,
  VideoSkeleton,
  VideoType,
} from "../src/lib/analysis/types/skeleton";
import { runStructurePass } from "../src/lib/analysis/structurePass";
import { safeValidateVideoSkeleton } from "../src/lib/analysis/validators/skeleton";
import testVideos from "./test-videos.json";

type TestVideo = {
  id: string;
  youtubeId?: string;
  youtubeUrl?: string;
  title: string;
  durationSeconds: number;
  bucket: string;
  type?: string;
  expectedChapters?: number;
  notes?: string;
};

type StructureTestResult = {
  videoId: string;
  title: string;
  bucket: string;
  durationSeconds: number;
  source: "gemini" | "fallback" | "mock";
  success: boolean;
  latencyMs: number;
  detectedVideoType?: VideoType;
  expectedVideoType?: VideoType;
  chapterCount?: number;
  keyMomentCount?: number;
  errors: string[];
  warnings: string[];
  flags: {
    chapterStructureOk: boolean;
    keyMomentsOk: boolean;
    typeMatch?: boolean;
  };
};

type CountRange = { min: number; max: number };
type CountGuidance = { chapters: CountRange; keyMoments: CountRange };

type CliArgs = {
  bucket?: string;
  video?: string;
  mock: boolean;
  updateTypes: boolean;
  throttleMs?: number;
  verbose: boolean;
};

const VIDEO_TYPES: VideoType[] = [
  "tutorial",
  "essay",
  "vlog",
  "reaction",
  "interview",
  "documentary",
  "entertainment",
  "other",
];

const TYPE_EQUIVALENTS: Record<VideoType, VideoType[]> = {
  essay: ["documentary"],
  documentary: ["essay"],
  tutorial: [],
  vlog: [],
  reaction: [],
  interview: [],
  entertainment: [],
  other: [],
};

const isTypeMatch = (expected: VideoType, actual: VideoType) =>
  expected === actual || TYPE_EQUIVALENTS[expected]?.includes(actual);

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_DURATION_DRIFT_PCT = 0.05;
const MIN_TYPE_ACCURACY_PCT = 80;
const MIN_CHAPTER_STRUCTURE_PCT = 90;

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  let bucket: string | undefined;
  let video: string | undefined;
  let mock = false;
  let updateTypes = false;
  let throttleMs: number | undefined;
  let verbose = false;

  for (const arg of args) {
    if (arg.startsWith("--bucket=")) {
      bucket = arg.replace("--bucket=", "");
    } else if (arg.startsWith("--video=")) {
      video = arg.replace("--video=", "");
    } else if (arg === "--mock") {
      mock = true;
    } else if (arg === "--update-types") {
      updateTypes = true;
    } else if (arg.startsWith("--throttle-ms=")) {
      const value = Number.parseInt(arg.replace("--throttle-ms=", ""), 10);
      throttleMs = Number.isFinite(value) && value >= 0 ? value : throttleMs;
    } else if (arg === "--verbose" || arg === "-v") {
      verbose = true;
    }
  }

  return { bucket, video, mock, updateTypes, throttleMs, verbose };
};

const loadEnvFile = (filePath: string) => {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    if (!key || process.env[key]) continue;
    let value = trimmed.slice(eqIndex + 1).trim();
    if (value.startsWith("\"") && value.endsWith("\"")) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    process.env[key] = value.replace(/\\n/g, "\n");
  }
};

const loadEnv = () => {
  const cwd = process.cwd();
  loadEnvFile(path.join(cwd, ".env.local"));
  loadEnvFile(path.join(cwd, ".env"));
};

const sleep = async (ms: number) => {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const normalizeExpectedType = (raw?: string): VideoType | undefined => {
  if (!raw) return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "unknown" || normalized === "mixed") return undefined;
  return (VIDEO_TYPES as string[]).includes(normalized) ? (normalized as VideoType) : undefined;
};

const buildCountGuidance = (durationSeconds?: number): CountGuidance => {
  if (!durationSeconds || durationSeconds <= 0) {
    return { chapters: { min: 3, max: 7 }, keyMoments: { min: 2, max: 5 } };
  }
  if (durationSeconds < 3 * 60) {
    return { chapters: { min: 3, max: 4 }, keyMoments: { min: 2, max: 3 } };
  }
  if (durationSeconds <= 10 * 60) {
    return { chapters: { min: 4, max: 5 }, keyMoments: { min: 3, max: 4 } };
  }
  if (durationSeconds <= 20 * 60) {
    return { chapters: { min: 5, max: 6 }, keyMoments: { min: 4, max: 5 } };
  }
  return { chapters: { min: 6, max: 7 }, keyMoments: { min: 5, max: 5 } };
};

const resolveChapterCount = (video: TestVideo, guidance: CountGuidance) => {
  const target = video.expectedChapters;
  if (target && Number.isFinite(target)) {
    return Math.max(guidance.chapters.min, Math.min(guidance.chapters.max, target));
  }
  return Math.round((guidance.chapters.min + guidance.chapters.max) / 2);
};

const buildChapters = (
  durationSeconds: number,
  count: number,
  titles?: string[],
): Chapter[] => {
  const chapters: Chapter[] = [];
  const adjustedDuration = Math.max(durationSeconds, count);
  for (let index = 0; index < count; index += 1) {
    const startSeconds = Math.floor((adjustedDuration / count) * index);
    const endSeconds =
      index === count - 1
        ? adjustedDuration
        : Math.floor((adjustedDuration / count) * (index + 1));
    chapters.push({
      id: `ch${index + 1}`,
      title: titles?.[index] ?? `Chapter ${index + 1}`,
      startSeconds,
      endSeconds: Math.max(endSeconds, startSeconds + 1),
      summary: "Mock chapter summary for structure testing.",
      chapterType: index === 0 ? "intro" : index === count - 1 ? "outro" : "body",
    });
  }
  return chapters;
};

const momentTypesForCount = (count: number): KeyMomentType[] => {
  if (count <= 1) return ["hook"];
  if (count === 2) return ["hook", "cta"];
  if (count === 3) return ["hook", "peak", "cta"];
  if (count === 4) return ["hook", "peak", "twist", "cta"];
  return ["hook", "peak", "twist", "payoff", "cta"];
};

const findChapterForTimestamp = (chapters: Chapter[], timestamp: number) =>
  chapters.find((chapter) => timestamp >= chapter.startSeconds && timestamp <= chapter.endSeconds) ??
  chapters[chapters.length - 1];

const buildMockKeyMoments = (
  durationSeconds: number,
  chapters: Chapter[],
  count: number,
): KeyMoment[] => {
  const types = momentTypesForCount(count);
  const hookTime = Math.min(5, Math.max(1, Math.round(durationSeconds * 0.02)));
  const ctaTime = Math.max(0, durationSeconds - 5);
  const interiorCount = Math.max(0, types.length - 2);
  const interiorStart = Math.round(durationSeconds * 0.2);
  const interiorEnd = Math.round(durationSeconds * 0.8);
  const step =
    interiorCount > 0 ? Math.max(1, (interiorEnd - interiorStart) / (interiorCount + 1)) : 0;

  const timestamps: number[] = [hookTime];
  for (let index = 0; index < interiorCount; index += 1) {
    timestamps.push(Math.round(interiorStart + step * (index + 1)));
  }
  timestamps.push(ctaTime);

  return types.map((type, index) => {
    const timestamp = Math.min(durationSeconds, Math.max(0, timestamps[index] ?? hookTime));
    const chapter = findChapterForTimestamp(chapters, timestamp);
    return {
      type,
      timestamp,
      chapterId: chapter?.id ?? "ch1",
      description: `Mock ${type} moment for testing.`,
    };
  });
};

const buildMockSkeleton = (video: TestVideo): VideoSkeleton => {
  const durationSeconds = video.durationSeconds || 300;
  const guidance = buildCountGuidance(durationSeconds);
  const chapterCount = resolveChapterCount(video, guidance);
  const chapters = buildChapters(durationSeconds, chapterCount);
  const keyMoments = buildMockKeyMoments(durationSeconds, chapters, guidance.keyMoments.min);
  const expectedType = normalizeExpectedType(video.type);

  return {
    durationSeconds,
    videoType: expectedType ?? "other",
    topicSummary: "Mock structure summary for testing. Details are placeholders only.",
    chapters,
    keyMoments,
    contentMix: {
      talkingHeadPct: 60,
      brollPct: 20,
      graphicsPct: 10,
      screencastPct: 5,
      otherPct: 5,
    },
    analysisHints: {
      hasMusic: false,
      hasSFX: false,
      hasOnScreenText: false,
      hasMultipleSpeakers: false,
      primaryLanguage: "unknown",
      estimatedComplexity: "medium",
    },
  };
};

const validateSkeleton = (
  skeleton: VideoSkeleton,
  video: TestVideo,
): { errors: string[]; warnings: string[]; flags: StructureTestResult["flags"] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const flags: StructureTestResult["flags"] = {
    chapterStructureOk: true,
    keyMomentsOk: true,
  };

  const expectedDuration = video.durationSeconds;
  const actualDuration = skeleton.durationSeconds;
  if (expectedDuration > 0) {
    const drift = Math.abs(actualDuration - expectedDuration) / expectedDuration;
    if (drift > MAX_DURATION_DRIFT_PCT) {
      warnings.push(
        `Duration drift ${Math.round(drift * 100)}% (expected ${expectedDuration}s, got ${actualDuration}s).`,
      );
    }
  }

  const guidance = buildCountGuidance(expectedDuration || actualDuration);
  const chapterCount = skeleton.chapters.length;
  if (chapterCount < guidance.chapters.min || chapterCount > guidance.chapters.max) {
    errors.push(
      `Chapter count ${chapterCount} outside ${guidance.chapters.min}-${guidance.chapters.max}.`,
    );
    flags.chapterStructureOk = false;
  }
  if (video.expectedChapters && chapterCount !== video.expectedChapters) {
    warnings.push(
      `Chapter count ${chapterCount} differs from expected ${video.expectedChapters}.`,
    );
  }

  const firstChapterStart = skeleton.chapters[0]?.startSeconds ?? 0;
  const lastChapterEnd = skeleton.chapters[chapterCount - 1]?.endSeconds ?? 0;
  if (firstChapterStart > 5) {
    errors.push(`First chapter starts late (${firstChapterStart}s).`);
    flags.chapterStructureOk = false;
  }
  if ((expectedDuration || actualDuration) - lastChapterEnd > 10) {
    errors.push(`Last chapter ends early (${lastChapterEnd}s).`);
    flags.chapterStructureOk = false;
  }

  for (let index = 1; index < chapterCount; index += 1) {
    const prev = skeleton.chapters[index - 1];
    const curr = skeleton.chapters[index];
    if (curr.startSeconds < prev.endSeconds - 1) {
      errors.push(
        `Chapter overlap: ${prev.id} ends at ${prev.endSeconds}, ${curr.id} starts at ${curr.startSeconds}.`,
      );
      flags.chapterStructureOk = false;
    }
    if (curr.startSeconds > prev.endSeconds + 5) {
      warnings.push(`Gap between chapters: ${prev.endSeconds}s to ${curr.startSeconds}s.`);
    }
  }

  const keyMomentCount = skeleton.keyMoments.length;
  if (keyMomentCount < guidance.keyMoments.min || keyMomentCount > guidance.keyMoments.max) {
    errors.push(
      `Key moment count ${keyMomentCount} outside ${guidance.keyMoments.min}-${guidance.keyMoments.max}.`,
    );
    flags.keyMomentsOk = false;
  }

  const durationForMoments = expectedDuration || actualDuration;
  const hook = skeleton.keyMoments.find((moment) => moment.type === "hook");
  const hookMaxSeconds = Math.max(10, Math.round(durationForMoments * 0.2));
  if (!hook) {
    errors.push("Missing hook key moment.");
    flags.keyMomentsOk = false;
  } else if (hook.timestamp > hookMaxSeconds) {
    warnings.push(`Hook occurs late (${hook.timestamp}s > ${hookMaxSeconds}s).`);
  }

  const conclusion = skeleton.keyMoments.find(
    (moment) => moment.type === "cta" || moment.type === "payoff",
  );
  const conclusionMinSeconds = Math.round(durationForMoments * 0.75);
  if (!conclusion) {
    errors.push("Missing conclusion key moment (cta or payoff).");
    flags.keyMomentsOk = false;
  } else if (conclusion.timestamp < conclusionMinSeconds) {
    warnings.push(
      `Conclusion occurs early (${conclusion.timestamp}s < ${conclusionMinSeconds}s).`,
    );
  }

  const chapterIds = new Set(skeleton.chapters.map((chapter) => chapter.id));
  for (const moment of skeleton.keyMoments) {
    if (!chapterIds.has(moment.chapterId)) {
      warnings.push(`Key moment ${moment.type} references unknown chapterId ${moment.chapterId}.`);
    }
  }

  const expectedType = normalizeExpectedType(video.type);
  if (expectedType) {
    flags.typeMatch = isTypeMatch(expectedType, skeleton.videoType);
    if (!flags.typeMatch) {
      warnings.push(`videoType ${skeleton.videoType} != expected ${expectedType}.`);
    } else if (skeleton.videoType !== expectedType) {
      warnings.push(
        `videoType ${skeleton.videoType} treated as equivalent to expected ${expectedType}.`,
      );
    }
  } else if (video.type && video.type !== "unknown" && video.type !== "mixed") {
    warnings.push(`Unsupported expected video type: ${video.type}.`);
  }

  return { errors, warnings, flags };
};

const buildGeminiConfig = (): AppConfig => ({
  analysisMode: "gemini",
  analysisVersion: "v2",
  geminiApiKey: process.env.GEMINI_API_KEY,
  youtubeApiKey: process.env.YOUTUBE_API_KEY,
  performanceEnabled: false,
  advancedMetricsEnabled: true,
  analysisV2MultimodalEnabled: true,
  structurePassEnabled: true,
  structurePassTimeoutMs:
    Number.parseInt(process.env.STRUCTURE_PASS_TIMEOUT_MS ?? "", 10) || DEFAULT_TIMEOUT_MS,
  geminiResponseSchemaEnabled: false,
  advancedMaxSegments: 5,
  advancedSegmentMaxSeconds: 120,
  advancedMaxTimelinePoints: 25,
  advancedMaxPassCostUsd: 0.25,
  advancedMaxPassDurationMs: 180000,
  showArchetypeFeatures: false,
  showReferenceLibrary: false,
});

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

async function main() {
  loadEnv();
  const args = parseArgs();
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  const useMock = args.mock || !hasGeminiKey;

  if (args.updateTypes && useMock) {
    console.error("Cannot update expected types in mock mode (GEMINI_API_KEY missing).");
    process.exit(1);
  }

  const throttleMs = args.throttleMs ?? (useMock ? 0 : 2000);

  const videos = (testVideos.videos as TestVideo[]).filter((video) => {
    if (args.bucket && video.bucket !== args.bucket) return false;
    if (args.video && video.id !== args.video) return false;
    return true;
  });

  if (videos.length === 0) {
    console.error("No videos matched filters.");
    process.exit(1);
  }

  console.log("===========================================");
  console.log("  CreatorSight Structure Pass Tests");
  console.log("===========================================\n");
  console.log(`Videos to test: ${videos.length}`);
  console.log(`Mode: ${useMock ? "mock" : "gemini"}\n`);
  if (!useMock) {
    console.log(`Throttle: ${throttleMs}ms between calls\n`);
  }

  const results: StructureTestResult[] = [];
  const updatedTypes = new Map<string, VideoType>();
  const config = useMock ? undefined : buildGeminiConfig();

  for (let index = 0; index < videos.length; index += 1) {
    const video = videos[index];
    console.log(`Testing: ${video.title}`);
    const startTime = Date.now();
    let skeleton: VideoSkeleton;
    let source: StructureTestResult["source"] = "mock";
    let errorMessage: string | undefined;

    if (useMock) {
      skeleton = buildMockSkeleton(video);
      source = "mock";
    } else {
      const result = await runStructurePass(
        {
          youtubeUrl: video.youtubeUrl ?? `https://www.youtube.com/watch?v=${video.youtubeId}`,
          durationSeconds: video.durationSeconds,
        },
        { config },
      );
      skeleton = result.skeleton;
      source = result.source;
      errorMessage = result.error;
    }

    const latencyMs = Date.now() - startTime;
    const validation = safeValidateVideoSkeleton(skeleton);
    const errors: string[] = [];
    const warnings: string[] = [];
    let flags: StructureTestResult["flags"] = {
      chapterStructureOk: true,
      keyMomentsOk: true,
    };
    const expectedVideoType = normalizeExpectedType(video.type);
    let detectedVideoType: VideoType | undefined;
    let chapterCount: number | undefined;
    let keyMomentCount: number | undefined;

    if (!validation.success || !validation.data) {
      errors.push(`Schema validation failed: ${validation.error}`);
      flags.chapterStructureOk = false;
      flags.keyMomentsOk = false;
    } else {
      const validData = validation.data;
      detectedVideoType = validData.videoType;
      chapterCount = validData.chapters.length;
      keyMomentCount = validData.keyMoments.length;
      const checks = validateSkeleton(validData, video);
      errors.push(...checks.errors);
      warnings.push(...checks.warnings);
      flags = checks.flags;
      if (source === "gemini" && detectedVideoType) {
        updatedTypes.set(video.id, detectedVideoType);
      }
    }

    if (source === "fallback") {
      errors.push(`Structure pass used fallback: ${errorMessage ?? "unknown error"}`);
    }

    const result: StructureTestResult = {
      videoId: video.id,
      title: video.title,
      bucket: video.bucket,
      durationSeconds: video.durationSeconds,
      source,
      success: errors.length === 0,
      latencyMs,
      detectedVideoType,
      expectedVideoType,
      chapterCount,
      keyMomentCount,
      errors,
      warnings,
      flags,
    };

    results.push(result);

    const status = result.success ? "PASS" : "FAIL";
    console.log(`  ${status} | ${formatDuration(latencyMs)} | source=${source}`);
    result.errors.forEach((issue) => console.log(`    ERROR: ${issue}`));
    result.warnings.forEach((issue) => console.log(`    WARN: ${issue}`));
    if (args.verbose) {
      console.log(`    Chapters: ${chapterCount ?? "n/a"}`);
      console.log(`    Key moments: ${keyMomentCount ?? "n/a"}`);
      if (detectedVideoType) {
        console.log(`    Detected type: ${detectedVideoType}`);
      }
    }
    console.log("");

    if (!useMock && index < videos.length - 1) {
      await sleep(throttleMs);
    }
  }

  const total = results.length;
  const passed = results.filter((result) => result.success).length;
  const typeChecks = results.filter((result) => result.flags.typeMatch !== undefined);
  const typeCorrect = typeChecks.filter((result) => result.flags.typeMatch).length;
  const typeAccuracyPct =
    typeChecks.length > 0 ? Math.round((typeCorrect / typeChecks.length) * 100) : undefined;
  const chapterOkCount = results.filter((result) => result.flags.chapterStructureOk).length;
  const chapterStructurePct = Math.round((chapterOkCount / total) * 100);

  console.log("-------------------------------------------");
  console.log(`OVERALL: ${passed}/${total} passed`);
  console.log(`Chapter structure pass: ${chapterOkCount}/${total} (${chapterStructurePct}%)`);
  if (typeAccuracyPct === undefined) {
    console.log("Video type accuracy: n/a (no expected types provided)");
  } else {
    console.log(`Video type accuracy: ${typeCorrect}/${typeChecks.length} (${typeAccuracyPct}%)`);
  }
  console.log("-------------------------------------------\n");

  if (args.updateTypes) {
    let updateCount = 0;
    const updatedVideos = (testVideos.videos as TestVideo[]).map((video) => {
      const updatedType = updatedTypes.get(video.id);
      if (!updatedType) {
        return video;
      }
      updateCount += 1;
      return { ...video, type: updatedType };
    });
    fs.writeFileSync(
      path.join(__dirname, "test-videos.json"),
      JSON.stringify(
        {
          ...testVideos,
          videos: updatedVideos,
        },
        null,
        2,
      ),
    );
    console.log(`Updated expected types for ${updateCount} videos in scripts/test-videos.json`);
  }

  const failures: string[] = [];
  if (typeAccuracyPct !== undefined && typeAccuracyPct < MIN_TYPE_ACCURACY_PCT) {
    failures.push(
      `Video type accuracy ${typeAccuracyPct}% below ${MIN_TYPE_ACCURACY_PCT}%.`,
    );
  }
  if (chapterStructurePct < MIN_CHAPTER_STRUCTURE_PCT) {
    failures.push(
      `Chapter structure pass ${chapterStructurePct}% below ${MIN_CHAPTER_STRUCTURE_PCT}%.`,
    );
  }

  const resultsPath = path.join(__dirname, "structure-pass-results.json");
  fs.writeFileSync(
    resultsPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        mode: useMock ? "mock" : "gemini",
        summary: {
          passed,
          total,
          chapterStructurePct,
          typeAccuracyPct,
        },
        results,
      },
      null,
      2,
    ),
  );
  console.log(`Results written to: ${resultsPath}`);

  if (failures.length > 0) {
    console.error("\nFailures:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  process.exit(passed === total ? 0 : 1);
}

main().catch((error) => {
  console.error("Structure pass test failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
