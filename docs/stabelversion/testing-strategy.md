# CreatorSight Testing Strategy

## Document Information
- **Purpose**: How to test the tiered analysis system for stability and correctness
- **Related**: `creatorsight-stability-refactor.md`, `prompt-templates.md`, `schema-migration-v2.md`
- **Status**: Ready for implementation

---

## Testing Objectives

1. **Stability**: Analysis completes without errors for various video lengths
2. **Correctness**: Metrics are accurate and consistent
3. **Performance**: Latency and cost within acceptable bounds
4. **Graceful degradation**: Partial failures don't crash the system

---

## Test Video Selection

### Duration Buckets

| Bucket | Duration | Example Count | Purpose |
|--------|----------|---------------|---------|
| **Micro** | < 1 min | 3 videos | Shorts, clips |
| **Short** | 1-3 min | 5 videos | Quick tutorials |
| **Medium** | 3-10 min | 5 videos | Standard content |
| **Long** | 10-20 min | 5 videos | Deep dives |
| **Extended** | 20-45 min | 3 videos | Podcasts, lectures |
| **Marathon** | > 45 min | 2 videos | Edge case stress |

### Content Type Coverage

| Type | Videos | Example |
|------|--------|---------|
| Tutorial | 4 | Coding tutorial, cooking recipe |
| Essay | 3 | Video essay, documentary-style |
| Vlog | 3 | Daily vlog, travel content |
| Reaction | 2 | React content, commentary |
| Interview | 2 | Podcast, Q&A |
| Entertainment | 3 | Sketch, gaming |
| Mixed | 3 | Hybrid formats |

### Test Video Registry

```json
// scripts/test-videos.json
{
  "videos": [
    {
      "id": "test_micro_1",
      "youtubeId": "dQw4w9WgXcQ",
      "title": "Test: Micro Music Video",
      "durationSeconds": 45,
      "bucket": "micro",
      "type": "entertainment",
      "expectedChapters": 3,
      "notes": "Fast cuts, music throughout"
    },
    {
      "id": "test_short_tutorial_1",
      "youtubeId": "ACTUAL_VIDEO_ID",
      "title": "Test: Short Coding Tutorial",
      "durationSeconds": 180,
      "bucket": "short",
      "type": "tutorial",
      "expectedChapters": 4,
      "knownMetrics": {
        "voice.speakingRate": { "min": 140, "max": 180 },
        "visual.cutRate": { "min": 3, "max": 8 }
      },
      "notes": "Clear structure, screenshare + talking head"
    },
    {
      "id": "test_10min_essay",
      "youtubeId": "ACTUAL_VIDEO_ID",
      "title": "Test: 10-Minute Video Essay",
      "durationSeconds": 600,
      "bucket": "medium",
      "type": "essay",
      "expectedChapters": 5,
      "knownMetrics": {
        "narrative.structureClarity": { "min": 60, "max": 90 },
        "language.metaphorDensity": { "min": 40, "max": 80 }
      },
      "notes": "Strong narrative structure, voiceover + b-roll"
    },
    {
      "id": "test_20min_tutorial",
      "youtubeId": "ACTUAL_VIDEO_ID",
      "title": "Test: 20-Minute Deep Dive Tutorial",
      "durationSeconds": 1200,
      "bucket": "long",
      "type": "tutorial",
      "expectedChapters": 6,
      "hasYouTubeChapters": true,
      "knownMetrics": {
        "voice.clarity": { "min": 70, "max": 100 },
        "sound.musicCoverage": { "min": 0, "max": 30 }
      },
      "notes": "Chapters provided by YouTube, screen recording heavy"
    },
    {
      "id": "test_20min_vlog",
      "youtubeId": "ACTUAL_VIDEO_ID",
      "title": "Test: 20-Minute Travel Vlog",
      "durationSeconds": 1200,
      "bucket": "long",
      "type": "vlog",
      "expectedChapters": 6,
      "knownMetrics": {
        "visual.environmentStability": { "min": 10, "max": 40 },
        "visual.movement": { "min": 50, "max": 90 }
      },
      "notes": "Many location changes, high visual variety"
    }
  ]
}
```

---

## Test Suites

### Suite 1: Tier 0 (Structure Pass) Tests

```typescript
// scripts/test-structure-pass.ts

import { extractVideoSkeleton } from '../src/lib/analysis/structurePass';
import testVideos from './test-videos.json';

interface StructureTestResult {
  videoId: string;
  duration: number;
  success: boolean;
  latencyMs: number;
  skeleton?: VideoSkeleton;
  errors: string[];
  warnings: string[];
}

async function testStructurePass(): Promise<StructureTestResult[]> {
  const results: StructureTestResult[] = [];
  
  for (const video of testVideos.videos) {
    console.log(`Testing structure pass: ${video.title} (${video.durationSeconds}s)`);
    
    const start = Date.now();
    const result: StructureTestResult = {
      videoId: video.id,
      duration: video.durationSeconds,
      success: false,
      latencyMs: 0,
      errors: [],
      warnings: [],
    };
    
    try {
      const skeleton = await extractVideoSkeleton(
        `https://www.youtube.com/watch?v=${video.youtubeId}`
      );
      result.latencyMs = Date.now() - start;
      result.skeleton = skeleton;
      
      // Validate skeleton
      const validation = validateSkeleton(skeleton, video);
      result.errors = validation.errors;
      result.warnings = validation.warnings;
      result.success = validation.errors.length === 0;
      
    } catch (error) {
      result.latencyMs = Date.now() - start;
      result.errors.push(`Exception: ${error.message}`);
    }
    
    results.push(result);
  }
  
  return results;
}

function validateSkeleton(skeleton: VideoSkeleton, expected: TestVideo): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Duration check (allow 5% variance)
  const durationDiff = Math.abs(skeleton.durationSeconds - expected.durationSeconds);
  if (durationDiff > expected.durationSeconds * 0.05) {
    errors.push(`Duration mismatch: got ${skeleton.durationSeconds}, expected ~${expected.durationSeconds}`);
  }
  
  // Chapter count
  if (skeleton.chapters.length < 3) {
    errors.push(`Too few chapters: ${skeleton.chapters.length}`);
  }
  if (skeleton.chapters.length > 7) {
    warnings.push(`Many chapters: ${skeleton.chapters.length} (expected max 7)`);
  }
  
  // Chapters cover full video
  const firstChapterStart = skeleton.chapters[0]?.startSeconds ?? 0;
  const lastChapterEnd = skeleton.chapters[skeleton.chapters.length - 1]?.endSeconds ?? 0;
  if (firstChapterStart > 5) {
    errors.push(`First chapter doesn't start near 0: ${firstChapterStart}s`);
  }
  if (lastChapterEnd < skeleton.durationSeconds - 10) {
    errors.push(`Last chapter ends early: ${lastChapterEnd}s vs ${skeleton.durationSeconds}s`);
  }
  
  // Chapter overlap check
  for (let i = 1; i < skeleton.chapters.length; i++) {
    const prev = skeleton.chapters[i - 1];
    const curr = skeleton.chapters[i];
    if (curr.startSeconds < prev.endSeconds - 1) {
      errors.push(`Chapter overlap: ${prev.title} ends at ${prev.endSeconds}, ${curr.title} starts at ${curr.startSeconds}`);
    }
    if (curr.startSeconds > prev.endSeconds + 5) {
      warnings.push(`Gap between chapters: ${prev.endSeconds} to ${curr.startSeconds}`);
    }
  }
  
  // Key moments
  if (skeleton.keyMoments.length === 0) {
    warnings.push('No key moments detected');
  }
  if (skeleton.keyMoments.length > 5) {
    warnings.push(`Many key moments: ${skeleton.keyMoments.length}`);
  }
  
  // Content mix sums to 100
  const mixTotal = 
    skeleton.contentMix.talkingHeadPct +
    skeleton.contentMix.brollPct +
    skeleton.contentMix.graphicsPct +
    skeleton.contentMix.screencastPct +
    skeleton.contentMix.otherPct;
  if (Math.abs(mixTotal - 100) > 5) {
    errors.push(`Content mix doesn't sum to 100: ${mixTotal}`);
  }
  
  // Video type reasonable
  if (skeleton.videoType === 'other' && expected.type !== 'mixed') {
    warnings.push(`Video type is 'other', expected '${expected.type}'`);
  }
  
  return { errors, warnings };
}

// Run and report
testStructurePass().then(results => {
  console.log('\n=== STRUCTURE PASS TEST RESULTS ===\n');
  
  const byBucket = groupBy(results, r => 
    testVideos.videos.find(v => v.id === r.videoId)?.bucket ?? 'unknown'
  );
  
  for (const [bucket, bucketResults] of Object.entries(byBucket)) {
    const success = bucketResults.filter(r => r.success).length;
    const total = bucketResults.length;
    const avgLatency = average(bucketResults.map(r => r.latencyMs));
    
    console.log(`${bucket.toUpperCase()}: ${success}/${total} passed, avg ${avgLatency.toFixed(0)}ms`);
    
    for (const r of bucketResults) {
      const status = r.success ? '✓' : '✗';
      console.log(`  ${status} ${r.videoId} (${r.latencyMs}ms)`);
      r.errors.forEach(e => console.log(`    ERROR: ${e}`));
      r.warnings.forEach(w => console.log(`    WARN: ${w}`));
    }
  }
  
  // Summary
  const totalSuccess = results.filter(r => r.success).length;
  const totalErrors = results.filter(r => r.errors.length > 0).length;
  
  console.log(`\nOVERALL: ${totalSuccess}/${results.length} passed`);
  
  if (totalErrors > 0) {
    process.exit(1);
  }
});
```

### Suite 2: Tier 1 (Core Metrics) Tests

```typescript
// scripts/test-core-pass.ts

interface CoreTestResult {
  videoId: string;
  duration: number;
  success: boolean;
  latencyMs: number;
  chaptersAnalyzed: number;
  totalChapters: number;
  observedPct: number;
  metricAccuracy: Record<string, MetricAccuracyResult>;
  errors: string[];
  warnings: string[];
}

interface MetricAccuracyResult {
  expected: { min: number; max: number };
  actual: number;
  inRange: boolean;
}

async function testCorePass(): Promise<CoreTestResult[]> {
  const results: CoreTestResult[] = [];
  
  for (const video of testVideos.videos) {
    console.log(`Testing core pass: ${video.title}`);
    
    const start = Date.now();
    const result: CoreTestResult = {
      videoId: video.id,
      duration: video.durationSeconds,
      success: false,
      latencyMs: 0,
      chaptersAnalyzed: 0,
      totalChapters: 0,
      observedPct: 0,
      metricAccuracy: {},
      errors: [],
      warnings: [],
    };
    
    try {
      // First get skeleton
      const skeleton = await extractVideoSkeleton(
        `https://www.youtube.com/watch?v=${video.youtubeId}`
      );
      
      // Then get core metrics
      const coreMetrics = await analyzeCoreMetrics(
        `https://www.youtube.com/watch?v=${video.youtubeId}`,
        skeleton
      );
      
      result.latencyMs = Date.now() - start;
      result.chaptersAnalyzed = coreMetrics.coverage.chaptersAnalyzed;
      result.totalChapters = coreMetrics.coverage.totalChapters;
      result.observedPct = coreMetrics.coverage.tier1ObservedPct;
      
      // Validate against known metrics
      if (video.knownMetrics) {
        for (const [metricPath, expected] of Object.entries(video.knownMetrics)) {
          const actual = getMetricValue(coreMetrics, metricPath);
          result.metricAccuracy[metricPath] = {
            expected,
            actual,
            inRange: actual >= expected.min && actual <= expected.max,
          };
          
          if (!result.metricAccuracy[metricPath].inRange) {
            result.errors.push(
              `${metricPath}: ${actual} not in [${expected.min}, ${expected.max}]`
            );
          }
        }
      }
      
      // Coverage thresholds
      if (result.observedPct < 70) {
        result.errors.push(`Low observation rate: ${result.observedPct}%`);
      } else if (result.observedPct < 85) {
        result.warnings.push(`Moderate observation rate: ${result.observedPct}%`);
      }
      
      if (result.chaptersAnalyzed < result.totalChapters) {
        result.warnings.push(
          `Not all chapters analyzed: ${result.chaptersAnalyzed}/${result.totalChapters}`
        );
      }
      
      result.success = result.errors.length === 0;
      
    } catch (error) {
      result.latencyMs = Date.now() - start;
      result.errors.push(`Exception: ${error.message}`);
    }
    
    results.push(result);
  }
  
  return results;
}
```

### Suite 3: Tier 2 (Advanced Metrics) Tests

```typescript
// scripts/test-advanced-pass.ts

interface AdvancedTestResult {
  videoId: string;
  duration: number;
  success: boolean;
  latencyMs: number;
  segmentsAnalyzed: number;
  segmentsPlanned: number;
  timelinesPopulated: number;
  maxTimelineLength: number;
  errors: string[];
  warnings: string[];
}

async function testAdvancedPass(): Promise<AdvancedTestResult[]> {
  const results: AdvancedTestResult[] = [];
  
  // Only test medium+ videos for advanced metrics
  const advancedTestVideos = testVideos.videos.filter(
    v => v.durationSeconds >= 180
  );
  
  for (const video of advancedTestVideos) {
    console.log(`Testing advanced pass: ${video.title}`);
    
    const start = Date.now();
    const result: AdvancedTestResult = {
      videoId: video.id,
      duration: video.durationSeconds,
      success: false,
      latencyMs: 0,
      segmentsAnalyzed: 0,
      segmentsPlanned: 0,
      timelinesPopulated: 0,
      maxTimelineLength: 0,
      errors: [],
      warnings: [],
    };
    
    try {
      const skeleton = await extractVideoSkeleton(
        `https://www.youtube.com/watch?v=${video.youtubeId}`
      );
      const coreMetrics = await analyzeCoreMetrics(
        `https://www.youtube.com/watch?v=${video.youtubeId}`,
        skeleton
      );
      
      // Plan advanced analysis
      const plan = planAdvancedAnalysis(skeleton, coreMetrics);
      result.segmentsPlanned = plan.segments.length;
      
      // Run advanced analysis
      const advancedMetrics = await analyzeAdvancedMetrics(
        `https://www.youtube.com/watch?v=${video.youtubeId}`,
        skeleton,
        coreMetrics,
        plan
      );
      
      result.latencyMs = Date.now() - start;
      result.segmentsAnalyzed = advancedMetrics?.analyzedSegments?.length ?? 0;
      
      // Check timeline lengths
      if (advancedMetrics?.bySegment) {
        for (const segment of Object.values(advancedMetrics.bySegment)) {
          const timelines = extractTimelines(segment);
          result.timelinesPopulated += timelines.length;
          result.maxTimelineLength = Math.max(
            result.maxTimelineLength,
            ...timelines.map(t => t.length)
          );
        }
      }
      
      // Validate timeline caps
      const expectedMaxPoints = getMaxTimelinePoints(video.durationSeconds);
      if (result.maxTimelineLength > expectedMaxPoints + 5) {
        result.errors.push(
          `Timeline too long: ${result.maxTimelineLength} (max ${expectedMaxPoints})`
        );
      }
      
      // At least some timelines should be populated
      if (result.segmentsAnalyzed > 0 && result.timelinesPopulated === 0) {
        result.warnings.push('No timelines populated in advanced metrics');
      }
      
      result.success = result.errors.length === 0;
      
    } catch (error) {
      result.latencyMs = Date.now() - start;
      result.errors.push(`Exception: ${error.message}`);
    }
    
    results.push(result);
  }
  
  return results;
}
```

### Suite 4: Full Pipeline Tests

```typescript
// scripts/test-full-pipeline.ts

interface PipelineTestResult {
  videoId: string;
  duration: number;
  bucket: string;
  success: boolean;
  
  // Timing
  totalLatencyMs: number;
  structureLatencyMs: number;
  coreLatencyMs: number;
  advancedLatencyMs: number;
  derivedLatencyMs: number;
  
  // Cost
  estimatedCostUsd: number;
  geminiCallCount: number;
  
  // Quality
  tier1ObservedPct: number;
  tier2ObservedPct: number;
  tier3ComputedPct: number;
  
  // Output
  fingerprint?: VideoFingerprintJson_v2;
  
  errors: string[];
  warnings: string[];
}

async function testFullPipeline(): Promise<PipelineTestResult[]> {
  const results: PipelineTestResult[] = [];
  
  for (const video of testVideos.videos) {
    console.log(`\n=== Testing full pipeline: ${video.title} ===`);
    
    const result: PipelineTestResult = {
      videoId: video.id,
      duration: video.durationSeconds,
      bucket: video.bucket,
      success: false,
      totalLatencyMs: 0,
      structureLatencyMs: 0,
      coreLatencyMs: 0,
      advancedLatencyMs: 0,
      derivedLatencyMs: 0,
      estimatedCostUsd: 0,
      geminiCallCount: 0,
      tier1ObservedPct: 0,
      tier2ObservedPct: 0,
      tier3ComputedPct: 0,
      errors: [],
      warnings: [],
    };
    
    const totalStart = Date.now();
    
    try {
      // Tier 0: Structure
      console.log('  Running structure pass...');
      const structureStart = Date.now();
      const skeleton = await extractVideoSkeleton(
        `https://www.youtube.com/watch?v=${video.youtubeId}`
      );
      result.structureLatencyMs = Date.now() - structureStart;
      result.geminiCallCount++;
      
      // Tier 1: Core
      console.log('  Running core pass...');
      const coreStart = Date.now();
      const coreMetrics = await analyzeCoreMetrics(
        `https://www.youtube.com/watch?v=${video.youtubeId}`,
        skeleton
      );
      result.coreLatencyMs = Date.now() - coreStart;
      result.geminiCallCount += skeleton.chapters.length; // Per-chapter calls
      result.tier1ObservedPct = coreMetrics.coverage.tier1ObservedPct;
      
      // Tier 2: Advanced (if appropriate)
      let advancedMetrics;
      if (video.durationSeconds >= 180) {
        console.log('  Running advanced pass...');
        const advancedStart = Date.now();
        const plan = planAdvancedAnalysis(skeleton, coreMetrics);
        advancedMetrics = await analyzeAdvancedMetrics(
          `https://www.youtube.com/watch?v=${video.youtubeId}`,
          skeleton,
          coreMetrics,
          plan
        );
        result.advancedLatencyMs = Date.now() - advancedStart;
        result.geminiCallCount += plan.segments.length;
        result.tier2ObservedPct = advancedMetrics?.coverage?.tier2ObservedPct ?? 0;
      }
      
      // Tier 3: Derived
      console.log('  Computing derived scores...');
      const derivedStart = Date.now();
      const derivedScores = computeDerivedScores(coreMetrics, advancedMetrics);
      result.derivedLatencyMs = Date.now() - derivedStart;
      result.tier3ComputedPct = derivedScores.computation.confidence * 100;
      
      result.totalLatencyMs = Date.now() - totalStart;
      
      // Estimate cost
      result.estimatedCostUsd = estimateCost(result.geminiCallCount, video.durationSeconds);
      
      // Build fingerprint
      result.fingerprint = buildFingerprint({
        skeleton,
        coreMetrics,
        advancedMetrics,
        derivedScores,
      });
      
      // Validate fingerprint
      const validation = validateFingerprint(result.fingerprint);
      result.errors.push(...validation.errors);
      result.warnings.push(...validation.warnings);
      
      result.success = result.errors.length === 0;
      
    } catch (error) {
      result.totalLatencyMs = Date.now() - totalStart;
      result.errors.push(`Pipeline exception: ${error.message}`);
    }
    
    results.push(result);
    
    // Log summary for this video
    console.log(`  Status: ${result.success ? 'PASS' : 'FAIL'}`);
    console.log(`  Latency: ${result.totalLatencyMs}ms (structure: ${result.structureLatencyMs}, core: ${result.coreLatencyMs}, advanced: ${result.advancedLatencyMs})`);
    console.log(`  Cost: ~$${result.estimatedCostUsd.toFixed(3)} (${result.geminiCallCount} calls)`);
    console.log(`  Coverage: T1=${result.tier1ObservedPct}%, T2=${result.tier2ObservedPct}%, T3=${result.tier3ComputedPct}%`);
    result.errors.forEach(e => console.log(`  ERROR: ${e}`));
    result.warnings.forEach(w => console.log(`  WARN: ${w}`));
  }
  
  return results;
}
```

---

## 10-Minute Video Test Checklist

For medium-length videos (~10 minutes):

### What to Verify

```markdown
## 10-Minute Video Test: {{videoTitle}}

### Tier 0: Structure
- [ ] Completes in < 30 seconds
- [ ] 4-5 chapters generated
- [ ] Chapters cover full video (no gaps > 5s)
- [ ] Video type correctly identified
- [ ] At least 3 key moments marked
- [ ] Content mix sums to 100%

### Tier 1: Core Metrics
- [ ] All chapters analyzed
- [ ] > 85% metrics observed
- [ ] No chapter takes > 45s to analyze
- [ ] Speaking rate in reasonable range (100-200 wpm)
- [ ] Cut rate detected (not "unobserved")
- [ ] Music coverage detected if music present

### Tier 2: Advanced (selective)
- [ ] Hook chapter analyzed
- [ ] 1-2 additional high-value chapters analyzed
- [ ] Timeline points capped at 20
- [ ] Timelines cover segment duration
- [ ] No timeline gaps > 10% of segment

### Tier 3: Derived
- [ ] All 5 meta axes computed
- [ ] Second-order scores computed
- [ ] confidence > 0.8

### Performance
- [ ] Total time < 3 minutes
- [ ] Cost < $0.15
- [ ] No timeout errors
```

### Expected Results for 10-Minute Videos

| Metric | Target | Minimum |
|--------|--------|---------|
| Structure latency | < 20s | < 30s |
| Core latency (total) | < 90s | < 120s |
| Advanced latency | < 60s | < 90s |
| Total latency | < 180s | < 240s |
| Estimated cost | < $0.10 | < $0.15 |
| Tier 1 observed | > 90% | > 80% |
| Tier 2 observed | > 75% | > 60% |
| Tier 3 computed | > 90% | > 80% |

---

## 20-Minute Video Test Checklist

For longer videos (~20 minutes):

### What to Verify

```markdown
## 20-Minute Video Test: {{videoTitle}}

### Tier 0: Structure
- [ ] Completes in < 45 seconds
- [ ] 5-6 chapters generated
- [ ] Chapters cover full video
- [ ] YouTube chapters used if available
- [ ] 4-5 key moments marked
- [ ] Complexity estimated correctly

### Tier 1: Core Metrics
- [ ] Per-chapter execution (not full video)
- [ ] Each chapter < 30s to analyze
- [ ] > 80% metrics observed
- [ ] Chapter scores vary appropriately
- [ ] Aggregation weights by duration

### Tier 2: Advanced (selective)
- [ ] Max 5 segments selected
- [ ] Selection logic reasonable (hook, ending, high-cut chapters)
- [ ] Timeline points capped at 15-20
- [ ] Total advanced time < 3 minutes

### Tier 3: Derived
- [ ] Handles partial tier 2 data
- [ ] confidence > 0.7
- [ ] Meta axes stable across runs

### Performance
- [ ] Total time < 5 minutes
- [ ] Cost < $0.25
- [ ] Memory usage stable
- [ ] No rate limit errors
```

### Expected Results for 20-Minute Videos

| Metric | Target | Minimum |
|--------|--------|---------|
| Structure latency | < 30s | < 45s |
| Core latency (total) | < 150s | < 180s |
| Advanced latency | < 90s | < 120s |
| Total latency | < 300s | < 360s |
| Estimated cost | < $0.20 | < $0.30 |
| Tier 1 observed | > 85% | > 75% |
| Tier 2 observed | > 70% | > 55% |
| Tier 3 computed | > 85% | > 70% |

---

## Stress Tests

### Test: Maximum Video Length

```typescript
// Test with 45+ minute video
async function testMarathonVideo() {
  const video = testVideos.videos.find(v => v.bucket === 'marathon');
  
  const result = await analyzeWithTimeout(video, {
    timeoutMs: 600000, // 10 minute timeout
    maxGeminiCalls: 15,
    maxCostUsd: 0.50,
  });
  
  // Marathon videos should still complete
  expect(result.success).toBe(true);
  
  // But with reduced coverage
  expect(result.tier1ObservedPct).toBeGreaterThan(60);
  expect(result.tier2ObservedPct).toBeGreaterThan(40); // Lower expectation
  
  // Cost should be bounded
  expect(result.estimatedCostUsd).toBeLessThan(0.50);
}
```

### Test: Rapid Sequential Analysis

```typescript
// Test rate limiting and resource management
async function testRapidSequential() {
  const shortVideos = testVideos.videos
    .filter(v => v.bucket === 'short')
    .slice(0, 5);
  
  const start = Date.now();
  const results = [];
  
  for (const video of shortVideos) {
    const result = await analyzeVideo(video);
    results.push(result);
  }
  
  const totalTime = Date.now() - start;
  
  // All should succeed
  expect(results.every(r => r.success)).toBe(true);
  
  // Should handle rate limits gracefully
  expect(results.some(r => r.rateLimitHit)).toBe(false);
  
  // Total time reasonable (not serialized due to rate limits)
  expect(totalTime).toBeLessThan(300000); // 5 minutes for 5 videos
}
```

### Test: Partial Failure Recovery

```typescript
// Test that tier failures don't crash the pipeline
async function testPartialFailure() {
  // Mock tier 2 to fail
  jest.spyOn(advancedPass, 'analyzeAdvancedMetrics')
    .mockRejectedValue(new Error('Simulated failure'));
  
  const result = await analyzeVideo(testVideos.videos[0]);
  
  // Should still have tier 0 + tier 1 + tier 3
  expect(result.skeleton).toBeDefined();
  expect(result.coreMetrics).toBeDefined();
  expect(result.derivedScores).toBeDefined();
  
  // Advanced should be undefined, not crash
  expect(result.advancedMetrics).toBeUndefined();
  
  // Derived should compute with reduced confidence
  expect(result.derivedScores.computation.confidence).toBeLessThan(0.8);
  
  // Error should be logged
  expect(result.warnings).toContain(expect.stringContaining('Advanced metrics failed'));
}
```

---

## Consistency Tests

### Test: Same Video Multiple Runs

```typescript
// Test that results are stable across runs
async function testConsistency() {
  const video = testVideos.videos[0];
  
  const results = await Promise.all([
    analyzeVideo(video),
    analyzeVideo(video),
    analyzeVideo(video),
  ]);
  
  // Structure should be identical
  expect(results[0].skeleton.videoType).toBe(results[1].skeleton.videoType);
  expect(results[0].skeleton.chapters.length).toBe(results[1].skeleton.chapters.length);
  
  // Core scores should be within 10 points
  for (const metric of ['speakingRate', 'cutRate', 'musicCoverage']) {
    const scores = results.map(r => getMetricScore(r, metric));
    const variance = Math.max(...scores) - Math.min(...scores);
    expect(variance).toBeLessThan(15);
  }
  
  // Meta axes should be within 8 points
  for (const axis of ['voiceIntensity', 'visualDynamism']) {
    const scores = results.map(r => r.derivedScores.metaAxes[axis]);
    const variance = Math.max(...scores) - Math.min(...scores);
    expect(variance).toBeLessThan(10);
  }
}
```

---

## Running Tests

### NPM Scripts

```json
{
  "scripts": {
    "test:structure": "ts-node scripts/test-structure-pass.ts",
    "test:core": "ts-node scripts/test-core-pass.ts",
    "test:advanced": "ts-node scripts/test-advanced-pass.ts",
    "test:pipeline": "ts-node scripts/test-full-pipeline.ts",
    "test:10min": "ts-node scripts/test-full-pipeline.ts --filter=medium",
    "test:20min": "ts-node scripts/test-full-pipeline.ts --filter=long",
    "test:stress": "ts-node scripts/test-stress.ts",
    "test:consistency": "ts-node scripts/test-consistency.ts",
    "test:all": "npm run test:structure && npm run test:core && npm run test:advanced && npm run test:pipeline"
  }
}
```

### CI Integration

```yaml
# .github/workflows/analysis-tests.yml
name: Analysis Pipeline Tests

on:
  push:
    paths:
      - 'src/lib/analysis/**'
      - 'scripts/test-*.ts'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run structure tests
        run: npm run test:structure
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          
      - name: Run core tests
        run: npm run test:core
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          
      - name: Upload test results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

---

## Metrics Dashboard

Track these over time:

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `structure_pass_success_rate` | % of videos with valid skeleton | < 95% |
| `core_pass_observed_rate` | Avg tier 1 observation % | < 80% |
| `advanced_pass_success_rate` | % of advanced passes that complete | < 70% |
| `pipeline_latency_p95` | 95th percentile total latency | > 300s |
| `pipeline_cost_avg` | Average cost per video | > $0.30 |
| `tier3_confidence_avg` | Average derived score confidence | < 0.75 |
| `consistency_variance` | Max score variance across runs | > 15 |
