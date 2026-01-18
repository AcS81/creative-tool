#!/usr/bin/env ts-node
/**
 * Test Analysis Pipeline
 * 
 * Tests the current analysis system against test videos to verify:
 * - Completion rates across video durations
 * - Metric observation rates
 * - Latency and cost
 * - Error handling
 * 
 * Usage:
 *   npm run test:pipeline              # Test all videos
 *   npm run test:pipeline -- --bucket=medium  # Test only medium bucket
 *   npm run test:pipeline -- --video=test_long_20min  # Test specific video
 *   npm run test:pipeline -- --dry-run  # Show what would be tested
 *   npm run test:pipeline -- --tiered   # Run tiered core analysis
 */

import * as fs from "fs";
import * as path from "path";
import { getAppConfig } from "../src/lib/config";
import { analyzeVideoMultimodal, type MultimodalAnalysisResult } from "../src/lib/analysis/geminiMultimodalAnalyzer";
import { runStructurePass } from "../src/lib/analysis/structurePass";

// ============ Types ============

interface TestVideo {
  id: string;
  youtubeId: string;
  youtubeUrl: string;
  title: string;
  durationSeconds: number;
  bucket: string;
  type: string;
  expectedChapters: number;
  notes?: string;
  knownMetrics?: Record<string, { min: number; max: number }>;
}

interface TestVideosConfig {
  videos: TestVideo[];
  buckets: Record<string, { minSeconds: number; maxSeconds: number | null }>;
  thresholds: {
    structureLatencyMs: Record<string, number>;
    coreLatencyMs: Record<string, number>;
    totalLatencyMs: Record<string, number>;
    tier1ObservedPct: { min: number; target: number };
    maxCostUsd: Record<string, number>;
  };
}

interface TestResult {
  videoId: string;
  title: string;
  bucket: string;
  durationSeconds: number;
  
  // Status
  success: boolean;
  errorMessage?: string;
  
  // Timing
  totalLatencyMs: number;
  
  // Metrics
  observedMetricsPct: number;
  unobservedMetrics: string[];
  
  // Cost (from diagnostics)
  estimatedCostUsd?: number;
  geminiCalls?: number;
  
  // Coverage from diagnostics
  diagnostics?: {
    unobservedCounts: Record<string, number>;
    coverage?: {
      core?: Record<string, { observed: number; total: number; observedPct: number }>;
      advanced?: Record<string, { observed: number; total: number; observedPct: number }>;
    };
    passMetrics?: {
      totals?: {
        durationMs: number;
        attempts: number;
        estimatedCostUsd?: number;
      };
    };
  };
  
  // Validation
  warnings: string[];
  errors: string[];
}

// ============ Helpers ============

function loadTestVideos(): TestVideosConfig {
  const configPath = path.join(__dirname, "test-videos.json");
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw);
}

function parseArgs(): {
  bucket?: string;
  video?: string;
  dryRun: boolean;
  verbose: boolean;
  tiered: boolean;
} {
  const args = process.argv.slice(2);
  let bucket: string | undefined;
  let video: string | undefined;
  let dryRun = false;
  let verbose = false;
  let tiered = false;
  
  for (const arg of args) {
    if (arg.startsWith("--bucket=")) {
      bucket = arg.replace("--bucket=", "");
    } else if (arg.startsWith("--video=")) {
      video = arg.replace("--video=", "");
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--verbose" || arg === "-v") {
      verbose = true;
    } else if (arg === "--tiered") {
      tiered = true;
    }
  }
  
  return { bucket, video, dryRun, verbose, tiered };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatCost(usd: number | undefined): string {
  if (usd === undefined) return "unknown";
  return `$${usd.toFixed(3)}`;
}

function countObservedMetrics(result: MultimodalAnalysisResult): { observed: number; total: number; unobserved: string[] } {
  const unobserved: string[] = [];
  let observed = 0;
  let total = 0;
  
  // Count from coverage diagnostics if available
  if (result.diagnostics.coverage?.core) {
    for (const [domain, stats] of Object.entries(result.diagnostics.coverage.core)) {
      observed += stats.observed;
      total += stats.total;
      if (stats.missing) {
        unobserved.push(...stats.missing.map(m => `${domain}.${m}`));
      }
    }
  }
  
  // Also check unobservedCounts
  if (result.diagnostics.unobservedCounts) {
    for (const [domain, count] of Object.entries(result.diagnostics.unobservedCounts)) {
      if (count > 0 && !unobserved.some(u => u.startsWith(`${domain}.`))) {
        unobserved.push(`${domain}: ${count} unobserved`);
      }
    }
  }
  
  return { observed, total, unobserved };
}

function validateResult(result: MultimodalAnalysisResult, video: TestVideo, thresholds: TestVideosConfig["thresholds"]): { warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check observation rate
  const metrics = countObservedMetrics(result);
  const observedPct = metrics.total > 0 ? (metrics.observed / metrics.total) * 100 : 0;
  
  if (observedPct < thresholds.tier1ObservedPct.min) {
    errors.push(`Low observation rate: ${observedPct.toFixed(1)}% (min: ${thresholds.tier1ObservedPct.min}%)`);
  } else if (observedPct < thresholds.tier1ObservedPct.target) {
    warnings.push(`Below target observation rate: ${observedPct.toFixed(1)}% (target: ${thresholds.tier1ObservedPct.target}%)`);
  }
  
  // Check if beats/chapters were detected
  if (!result.beats || result.beats.length === 0) {
    warnings.push("No beats detected");
  } else if (result.beats.length < 3) {
    warnings.push(`Few beats detected: ${result.beats.length}`);
  }
  
  // Check profiles exist
  for (const domain of ["voice", "language", "narrative", "visual", "editing", "sound"] as const) {
    const profile = result.profiles[domain];
    if (!profile || !profile.scores || profile.scores.length === 0) {
      errors.push(`Missing or empty ${domain} profile`);
    }
  }
  
  return { warnings, errors };
}

// ============ Main Test Function ============

async function testVideo(
  video: TestVideo,
  config: ReturnType<typeof getAppConfig>,
  thresholds: TestVideosConfig["thresholds"],
  tiered: boolean,
): Promise<TestResult> {
  console.log(`\n  Testing: ${video.title}`);
  console.log(`  URL: ${video.youtubeUrl}`);
  console.log(`  Duration: ${video.durationSeconds}s (${video.bucket})`);
  
  const result: TestResult = {
    videoId: video.id,
    title: video.title,
    bucket: video.bucket,
    durationSeconds: video.durationSeconds,
    success: false,
    totalLatencyMs: 0,
    observedMetricsPct: 0,
    unobservedMetrics: [],
    warnings: [],
    errors: [],
  };
  
  const startTime = Date.now();
  
  try {
    // Run the analysis
    const structureResult = tiered
      ? await runStructurePass({ youtubeUrl: video.youtubeUrl }, { config })
      : null;
    const analysisResult = await analyzeVideoMultimodal({
      youtubeUrl: video.youtubeUrl,
      config,
      useTieredAnalysis: tiered,
      skeleton: structureResult?.skeleton,
    });
    
    result.totalLatencyMs = Date.now() - startTime;
    
    // Extract metrics
    const metrics = countObservedMetrics(analysisResult);
    result.observedMetricsPct = metrics.total > 0 ? (metrics.observed / metrics.total) * 100 : 0;
    result.unobservedMetrics = metrics.unobserved;
    
    // Extract cost/diagnostics
    result.diagnostics = {
      unobservedCounts: analysisResult.diagnostics.unobservedCounts,
      coverage: analysisResult.diagnostics.coverage,
      passMetrics: analysisResult.diagnostics.passMetrics,
    };
    
    if (analysisResult.diagnostics.passMetrics?.totals) {
      result.estimatedCostUsd = analysisResult.diagnostics.passMetrics.totals.estimatedCostUsd;
      result.geminiCalls = analysisResult.diagnostics.passMetrics.totals.attempts;
    }
    
    // Validate
    const validation = validateResult(analysisResult, video, thresholds);
    result.warnings = validation.warnings;
    result.errors = validation.errors;
    
    result.success = result.errors.length === 0;
    
  } catch (error: any) {
    result.totalLatencyMs = Date.now() - startTime;
    result.errorMessage = error.message || String(error);
    result.errors.push(`Exception: ${result.errorMessage}`);
  }
  
  // Log immediate result
  const status = result.success ? "✓ PASS" : "✗ FAIL";
  console.log(`  ${status} in ${formatDuration(result.totalLatencyMs)} | ${result.observedMetricsPct.toFixed(0)}% observed | ${formatCost(result.estimatedCostUsd)}`);
  
  if (result.errors.length > 0) {
    result.errors.forEach(e => console.log(`    ERROR: ${e}`));
  }
  if (result.warnings.length > 0) {
    result.warnings.forEach(w => console.log(`    WARN: ${w}`));
  }
  
  return result;
}

// ============ Main ============

async function main() {
  console.log("===========================================");
  console.log("  CreatorSight Analysis Pipeline Tests");
  console.log("===========================================\n");
  
  const { bucket, video, dryRun, verbose, tiered } = parseArgs();
  const testConfig = loadTestVideos();
  const appConfig = getAppConfig();
  
  // Filter videos based on args
  let videosToTest = testConfig.videos;
  
  if (video) {
    videosToTest = videosToTest.filter(v => v.id === video);
    if (videosToTest.length === 0) {
      console.error(`Video not found: ${video}`);
      console.error("Available videos:", testConfig.videos.map(v => v.id).join(", "));
      process.exit(1);
    }
  } else if (bucket) {
    videosToTest = videosToTest.filter(v => v.bucket === bucket);
    if (videosToTest.length === 0) {
      console.error(`No videos in bucket: ${bucket}`);
      console.error("Available buckets:", Object.keys(testConfig.buckets).join(", "));
      process.exit(1);
    }
  }
  
  console.log(`Videos to test: ${videosToTest.length}`);
  console.log(`Buckets: ${[...new Set(videosToTest.map(v => v.bucket))].join(", ")}`);
  console.log(`Analysis mode: ${appConfig.analysisMode}`);
  console.log(`Advanced metrics: ${appConfig.advancedMetricsEnabled !== false ? "enabled" : "disabled"}`);
  console.log(`Tiered analysis: ${tiered ? "enabled" : "disabled"}`);
  
  if (dryRun) {
    console.log("\n[DRY RUN] Would test these videos:");
    videosToTest.forEach(v => {
      console.log(`  - ${v.id}: ${v.title} (${v.durationSeconds}s, ${v.bucket})`);
    });
    process.exit(0);
  }
  
  // Run tests
  const results: TestResult[] = [];
  
  for (const videoToTest of videosToTest) {
    const result = await testVideo(videoToTest, appConfig, testConfig.thresholds, tiered);
    results.push(result);
    
    // Small delay between tests to avoid rate limiting
    if (videosToTest.indexOf(videoToTest) < videosToTest.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // ============ Summary Report ============
  
  console.log("\n===========================================");
  console.log("  SUMMARY");
  console.log("===========================================\n");
  
  // Group by bucket
  const byBucket: Record<string, TestResult[]> = {};
  for (const r of results) {
    if (!byBucket[r.bucket]) byBucket[r.bucket] = [];
    byBucket[r.bucket].push(r);
  }
  
  for (const [bucketName, bucketResults] of Object.entries(byBucket)) {
    const passed = bucketResults.filter(r => r.success).length;
    const total = bucketResults.length;
    const avgLatency = bucketResults.reduce((sum, r) => sum + r.totalLatencyMs, 0) / total;
    const avgObserved = bucketResults.reduce((sum, r) => sum + r.observedMetricsPct, 0) / total;
    const totalCost = bucketResults.reduce((sum, r) => sum + (r.estimatedCostUsd || 0), 0);
    
    console.log(`${bucketName.toUpperCase()} BUCKET: ${passed}/${total} passed`);
    console.log(`  Avg latency: ${formatDuration(avgLatency)}`);
    console.log(`  Avg observed: ${avgObserved.toFixed(1)}%`);
    console.log(`  Total cost: ${formatCost(totalCost)}`);
    console.log("");
  }
  
  // Overall
  const totalPassed = results.filter(r => r.success).length;
  const totalTests = results.length;
  const totalCost = results.reduce((sum, r) => sum + (r.estimatedCostUsd || 0), 0);
  const avgLatency = results.reduce((sum, r) => sum + r.totalLatencyMs, 0) / totalTests;
  
  console.log("-------------------------------------------");
  console.log(`OVERALL: ${totalPassed}/${totalTests} passed (${((totalPassed / totalTests) * 100).toFixed(0)}%)`);
  console.log(`Total cost: ${formatCost(totalCost)}`);
  console.log(`Avg latency: ${formatDuration(avgLatency)}`);
  console.log("-------------------------------------------\n");
  
  // Detailed results table
  if (verbose) {
    console.log("\nDETAILED RESULTS:");
    console.log("--------------------------------------------------------------------------------");
    console.log("Video ID                | Bucket   | Latency  | Observed | Cost    | Status");
    console.log("--------------------------------------------------------------------------------");
    for (const r of results) {
      const status = r.success ? "PASS" : "FAIL";
      console.log(
        `${r.videoId.padEnd(23)} | ${r.bucket.padEnd(8)} | ${formatDuration(r.totalLatencyMs).padEnd(8)} | ${r.observedMetricsPct.toFixed(0).padStart(3)}%     | ${formatCost(r.estimatedCostUsd).padEnd(7)} | ${status}`
      );
    }
    console.log("--------------------------------------------------------------------------------");
  }
  
  // Write results to file
  const resultsPath = path.join(__dirname, "test-results.json");
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      passed: totalPassed,
      total: totalTests,
      passRate: totalPassed / totalTests,
      totalCostUsd: totalCost,
      avgLatencyMs: avgLatency,
    },
    results,
  }, null, 2));
  console.log(`Results written to: ${resultsPath}`);
  
  // Exit with appropriate code
  process.exit(totalPassed === totalTests ? 0 : 1);
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
