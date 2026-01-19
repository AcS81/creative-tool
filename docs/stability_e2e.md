# End-to-End Testing Guide: Tiered Analysis

## Overview

This document describes the E2E testing strategy for the 4-tier analysis architecture, covering happy paths, failure scenarios, and quality validation.

## Test Matrix

### Configuration Matrix

| Test ID | Structure | Core | Advanced | Format | Schema | Expected Result |
|---------|-----------|------|----------|--------|--------|-----------------|
| E2E-01  | ✓ | ✓ | ✓ | full | inherit | Complete, high fidelity |
| E2E-02  | ✓ | ✓ | ✓ | compact | optional | Complete, acceptable quality |
| E2E-03  | ✓ | ✓ | ✗ | n/a | n/a | Basic complete, no advanced |
| E2E-04  | ✗ | ✓ | ✓ | compact | optional | Fallback skeleton, continue |
| E2E-05  | ✓ | ✗ | ✗ | n/a | n/a | Skeleton only, metrics unobserved |
| E2E-06  | ✗ | ✗ | ✗ | n/a | n/a | Graceful failure, error state |

---

## E2E Flow: Happy Path (E2E-01)

### Test Case: Complete Analysis with Full Response Format

**Configuration:**
```bash
ENABLE_TIERED_ANALYSIS=true
ENABLE_STRUCTURE_PASS=true
ENABLE_ADVANCED_METRICS=true
ADVANCED_RESPONSE_FORMAT=full
ADVANCED_SCHEMA_STRATEGY=inherit
```

**Input:** 8-minute tutorial video (well-formed, clear chapters)

**Expected Flow:**

#### Step 1: Structure Pass (0-15s)
```
POST /api/analyze
  → Job created (status: pending)
  → Structure pass starts

GET /api/analyze/[jobId] (polling)
  → status: "structure"
  → skeleton: { chapters: [...], keyMoments: [...], ... }
  → elapsedMs: ~12000
```

**Verification:**
- ✓ `skeleton.chapters.length >= 1`
- ✓ `skeleton.videoType` is valid enum
- ✓ `skeleton.durationSeconds` matches video
- ✓ `skeleton.keyMoments.length >= 0`

#### Step 2: Core Pass (15-45s)
```
GET /api/analyze/[jobId]
  → status: "core"
  → skeleton: {...}
  → coreMetrics: { voice: {...}, language: {...}, ... }
  → elapsedMs: ~35000
```

**Verification:**
- ✓ `coreMetrics` defined for all 5 domains
- ✓ Each domain has 6-8 metrics
- ✓ `observed: true` for >90% of metrics
- ✓ `score` values in range [0, 100]
- ✓ `value` strings are human-readable

#### Step 3: Advanced Pass (45-90s)
```
GET /api/analyze/[jobId]
  → status: "advanced"
  → coreMetrics: {...}
  → advancedMetrics: { paceTimeline: [...], ... }
  → elapsedMs: ~70000
```

**Verification:**
- ✓ `advancedMetrics` defined
- ✓ Timelines have 20-30 points (full mode)
- ✓ Arc metrics computed
- ✓ Second-order scores present

#### Step 4: Complete (90s+)
```
GET /api/analyze/[jobId]
  → status: "complete"
  → fingerprint: { perDomain: {...}, metaAxes: {...}, ... }
  → diagnostics: { coverage: {...}, passMetrics: {...} }
  → totalDurationMs: ~72000
```

**Verification:**
- ✓ `fingerprint.perDomain` complete for all domains
- ✓ `fingerprint.metaAxes` computed (8 axes)
- ✓ `diagnostics.coverage.overall >= 0.90`
- ✓ `diagnostics.passMetrics.totals.estimatedCostUsd < 0.30`

---

## E2E Flow: Compact Mode (E2E-02)

### Test Case: Fast Analysis with Compact Response Format

**Configuration:**
```bash
ADVANCED_RESPONSE_FORMAT=compact
ADVANCED_SCHEMA_STRATEGY=optional
```

**Expected Differences from Full Mode:**

1. **Timelines:**
   - Full: 20-30 points per timeline
   - Compact: 5-7 points per timeline
   - Variance tolerance: Interpolated values within 10% of full mode

2. **Latency:**
   - Full: ~60-70s for advanced pass
   - Compact: ~30-40s for advanced pass
   - Improvement: ~40% faster

3. **Cost:**
   - Full: $0.20-0.30
   - Compact: $0.12-0.18
   - Reduction: ~30-40%

4. **Quality:**
   - Derived scores variance: <10%
   - Coverage: Same (>90%)
   - Arc analysis: Slightly less granular but acceptable

**Verification:**
```typescript
// Compare full vs compact mode results
const fullMode = await analyzeVideo(url, { format: 'full' });
const compactMode = await analyzeVideo(url, { format: 'compact' });

// Timeline resolution
expect(fullMode.advancedMetrics.paceTimeline.length).toBeGreaterThan(20);
expect(compactMode.advancedMetrics.paceTimeline.length).toBeLessThan(10);

// Derived score variance
const metaAxesVariance = compareMetaAxes(fullMode.metaAxes, compactMode.metaAxes);
expect(metaAxesVariance).toBeLessThan(0.10); // <10% variance

// Cost comparison
expect(compactMode.cost).toBeLessThan(fullMode.cost * 0.7); // ~30% reduction
```

---

## E2E Flow: Structure Pass Failure (E2E-04)

### Test Case: Fallback Skeleton Generation

**Scenario:** Structure pass times out or fails

**Expected Behavior:**

```
Structure Pass
  └─> TIMEOUT after 30s
      └─> Generate fallback skeleton:
          {
            videoType: "unknown",
            chapters: [{ start: 0, end: duration, title: "Full Video" }],
            keyMoments: [],
            analysisHints: {}
          }
      └─> Continue to Core Pass
```

**Verification:**
- ✓ Analysis does NOT fail completely
- ✓ Fallback skeleton generated
- ✓ Core pass processes single chapter
- ✓ UI shows warning: "Video structure analysis timed out"
- ✓ Diagnostics include: `structurePass.status: "fallback"`

---

## E2E Flow: Core Pass Partial Failure (E2E-Mixed)

### Test Case: Some Chapters Fail, Others Succeed

**Scenario:** Video has 4 chapters, chapter 3 analysis fails

**Expected Behavior:**

```
Core Pass (per-chapter)
  ├─> Chapter 1: SUCCESS ✓
  ├─> Chapter 2: SUCCESS ✓
  ├─> Chapter 3: FAILURE ✗ → Mark all metrics unobserved
  └─> Chapter 4: SUCCESS ✓

Aggregation
  └─> Combine chapters 1, 2, 4
      └─> Chapter 3 excluded from averages
      └─> Coverage: 75% (3/4 chapters observed)
```

**Verification:**
- ✓ `coreMetrics.voice.pacing.observed: true` (aggregated from good chapters)
- ✓ `diagnostics.perChapterMetrics[2].allUnobserved: true`
- ✓ `diagnostics.coverage.chaptersCovered: 3`
- ✓ `diagnostics.coverage.chaptersTotal: 4`
- ✓ UI shows: "3/4 chapters analyzed (75%)"

---

## E2E Flow: Advanced Pass Disabled (E2E-03)

### Test Case: Basic Analysis Only

**Configuration:**
```bash
ENABLE_ADVANCED_METRICS=false
```

**Expected Flow:**

```
Structure Pass (0-15s) → SUCCESS ✓
  ↓
Core Pass (15-45s) → SUCCESS ✓
  ↓
Advanced Pass → SKIPPED (disabled)
  ↓
Derived Scores (computed from Core only)
  ↓
Complete (basic analysis)
```

**Verification:**
- ✓ Analysis completes in <50s
- ✓ Cost < $0.15
- ✓ `advancedMetrics: undefined`
- ✓ `metaAxes` computed from core metrics only
- ✓ UI shows: "Basic analysis complete"
- ✓ No timeline visualizations shown

---

## E2E Flow: Total Failure (E2E-06)

### Test Case: Catastrophic Failure

**Scenario:** All passes fail (network, API quota, etc.)

**Expected Behavior:**

```
Structure Pass → FAILURE
  └─> Fallback skeleton
      └─> Core Pass → FAILURE
          └─> Fallback unobserved metrics
              └─> Advanced Pass → SKIPPED
                  └─> Analysis "completes" with error state
```

**Verification:**
- ✓ No uncaught exceptions
- ✓ Job status: "failed" or "partial"
- ✓ Error message displayed to user
- ✓ Diagnostics capture all failure details
- ✓ User can retry analysis
- ✓ No partial/corrupt data saved

---

## Progressive UI Testing

### Test: UI Updates at Each Tier

**Scenario:** Monitor UI state during analysis

#### Checkpoint 1: Initial State
```typescript
expect(screen.getByText(/analyzing/i)).toBeInTheDocument();
expect(screen.getByText(/structure/i)).toBeInTheDocument();
expect(screen.queryByText(/video type/i)).not.toBeInTheDocument();
```

#### Checkpoint 2: Structure Complete
```typescript
await waitFor(() => {
  expect(screen.getByText(/video type/i)).toBeInTheDocument();
  expect(screen.getByText(/chapters/i)).toBeInTheDocument();
  expect(screen.getByTestId('chapter-timeline')).toBeInTheDocument();
});
```

#### Checkpoint 3: Core Complete
```typescript
await waitFor(() => {
  expect(screen.getByTestId('radar-chart')).toBeInTheDocument();
  expect(screen.getByText(/voice/i)).toBeInTheDocument();
  expect(screen.getByTestId('domain-scores')).toBeInTheDocument();
});
```

#### Checkpoint 4: Advanced Complete
```typescript
await waitFor(() => {
  expect(screen.getByTestId('pace-timeline')).toBeInTheDocument();
  expect(screen.getByText(/arc analysis/i)).toBeInTheDocument();
  expect(screen.getByTestId('advanced-coaching')).toBeInTheDocument();
});
```

#### Checkpoint 5: Complete
```typescript
await waitFor(() => {
  expect(screen.getByText(/analysis complete/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /export/i })).toBeEnabled();
});
```

---

## Observation Status Testing

### Test: Observed Metric Display

```typescript
test('shows observed badge for successfully measured metric', () => {
  const metric = { score: 75, value: "145 wpm", observed: true };
  render(<MetricValue metric={metric} label="Pacing" />);
  
  expect(screen.getByText('145 wpm')).toBeInTheDocument();
  expect(screen.getByTestId('observed-badge')).toBeInTheDocument();
  expect(screen.queryByText(/not measured/i)).not.toBeInTheDocument();
});
```

### Test: Unobserved Metric Display

```typescript
test('shows unobserved chip with reason', () => {
  const metric = { 
    score: 0, 
    value: "", 
    observed: false,
    reason: "No clear audio detected"
  };
  render(<MetricValue metric={metric} label="Pacing" />);
  
  expect(screen.getByText(/not measured/i)).toBeInTheDocument();
  expect(screen.getByTitle(/no clear audio/i)).toBeInTheDocument();
});
```

### Test: Coverage Indicator

```typescript
test('shows coverage indicator for domain', () => {
  const domain = {
    scores: [
      { observed: true },
      { observed: true },
      { observed: false },
      { observed: true },
    ]
  };
  render(<DomainView profile={domain} />);
  
  expect(screen.getByText(/3\/4 metrics observed/i)).toBeInTheDocument();
  expect(screen.getByText(/75%/i)).toBeInTheDocument();
});
```

---

## Error Recovery Testing

### Test: Retry After Failure

```typescript
test('allows retry after structure pass failure', async () => {
  // First attempt: structure fails
  const { result } = await analyzeVideo(url);
  expect(result.diagnostics.structurePass.status).toBe('fallback');
  
  // User clicks retry
  const retryResult = await analyzeVideo(url, { forceRefresh: true });
  
  // Second attempt: may succeed
  expect(retryResult.skeleton.chapters.length).toBeGreaterThan(1);
});
```

### Test: Salvage Mode for Invalid Response

```typescript
test('salvages partial data from malformed response', async () => {
  // Mock: Gemini returns partially invalid JSON
  mockGemini.mockReturnValueOnce({
    voice: { pacing: { score: 75 } }, // valid
    language: null, // invalid
    narrative: { /* valid */ }
  });
  
  const result = await analyzeCoreChapter(chapter);
  
  // Salvage extracts what's valid
  expect(result.voice.pacing.observed).toBe(true);
  expect(result.language.pacing.observed).toBe(false); // salvaged as unobserved
  expect(result.narrative.pacing.observed).toBe(true);
});
```

---

## Performance Benchmarks

### Test Suite: Golden Set Validation

```bash
npm run test:golden-set -- --format=full
npm run test:golden-set -- --format=compact
```

**Expected Results:**

| Metric | Full Mode | Compact Mode |
|--------|-----------|--------------|
| Completion rate | >95% | >95% |
| Avg latency (<5min) | 60-70s | 40-50s |
| Avg latency (5-15min) | 90-120s | 60-80s |
| Avg cost | $0.22 | $0.14 |
| Coverage (Tier 1) | >90% | >90% |
| Coverage (Tier 2) | >85% | >85% |
| Derived score variance | baseline | <10% |

---

## Automated Test Commands

### Run Full E2E Suite
```bash
npm run test:e2e
```

### Run Specific Test Categories
```bash
npm run test:e2e -- --grep "happy path"
npm run test:e2e -- --grep "fallback"
npm run test:e2e -- --grep "progressive"
```

### Run with Real API (Manual)
```bash
ANALYSIS_MODE=gemini npm run test:e2e:real
```

### Run Golden Set Comparison
```bash
npm run test:golden-compare
```

---

## Success Criteria Checklist

### Tier 0 (Structure)
- [ ] Completes in <15s for 95% of videos
- [ ] Generates valid skeleton
- [ ] Fallback works when timeout occurs
- [ ] Chapter detection accurate (>80% match manual review)

### Tier 1 (Core)
- [ ] >90% coverage for standard videos
- [ ] Per-chapter analysis succeeds independently
- [ ] Aggregation handles partial failures
- [ ] Observed/unobserved correctly marked

### Tier 2 (Advanced)
- [ ] Completes within budget (time & cost)
- [ ] Compact mode <10% variance from full
- [ ] Timeline interpolation acceptable
- [ ] Salvage mode recovers partial data

### Tier 3 (Derived)
- [ ] Computes in <1s
- [ ] Gracefully handles missing Tier 2 data
- [ ] Meta-axes within expected ranges
- [ ] Alignment scores correlate with manual review

### Progressive UI
- [ ] Updates occur at each tier completion
- [ ] No flash of unstyled content
- [ ] Loading states intuitive
- [ ] Error states actionable

### Error Handling
- [ ] No uncaught exceptions
- [ ] Partial failures don't block completion
- [ ] Error messages helpful
- [ ] Retry mechanism works
- [ ] Diagnostics capture root causes

---

## Manual Testing Checklist

### Video Variety
- [ ] Short video (<3min)
- [ ] Medium video (5-10min)
- [ ] Long video (>20min)
- [ ] Tutorial with chapters
- [ ] Vlog without chapters
- [ ] Review with b-roll
- [ ] Live stream recording
- [ ] Music video (minimal speech)
- [ ] Podcast (audio-only visual)

### Edge Cases
- [ ] Private video (should fail gracefully)
- [ ] Age-restricted video
- [ ] Very low quality audio
- [ ] No speech (music only)
- [ ] Multiple languages
- [ ] Heavy accents
- [ ] Extreme pacing (very fast/slow)

---

## Debugging Failed Tests

### Structure Pass Timeout
```bash
# Increase timeout
STRUCTURE_PASS_TIMEOUT_MS=45000 npm test

# Check logs
tail -f logs/structure-pass.log

# Verify API quota
curl -H "Authorization: Bearer $GEMINI_API_KEY" \
  https://generativelanguage.googleapis.com/v1beta/models
```

### Core Metrics Low Coverage
```bash
# Run with verbose diagnostics
DEBUG=creatorsight:core npm test

# Check per-chapter results
node scripts/debug-core-chapter.ts [videoId] [chapterIndex]
```

### Advanced Pass Cost Overrun
```bash
# Check segment planning
DEBUG=creatorsight:planner npm test

# Reduce segment budget
MAX_ADVANCED_SEGMENTS=3 npm test
```

---

## See Also

- [Stability Architecture](./stability-architecture.md)
- [Golden Set Validation](../scripts/run-multimodal-golden.ts)
- [Test Scripts README](../scripts/README.md)
