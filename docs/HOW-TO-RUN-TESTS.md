# How to Run Analysis Pipeline Tests

This guide explains how to test the CreatorSight analysis system with real videos.

---

## Quick Start

```bash
# Test all videos
npm run test:pipeline

# Test a specific video
npm run test:pipeline:5min    # 5-minute video
npm run test:pipeline:10min   # 13-minute video (treated as 10-min)
npm run test:pipeline:20min   # 20-minute video
npm run test:pipeline:40min   # 40-minute video

# Test by duration bucket
npm run test:pipeline:short   # All short videos
npm run test:pipeline:medium  # All medium videos
npm run test:pipeline:long    # All long videos

# Golden set (advanced metrics + baseline comparisons)
npm run golden:multimodal

# Pipeline test with selective advanced pass (Tier 2)
npm run test:pipeline -- --selective-advanced
```

---

## What Was Created

### 1. Test Video Registry (`scripts/test-videos.json`)

Contains your 4 test videos:
- **5 min**: [https://www.youtube.com/watch?v=IobYjhdAlH0](https://www.youtube.com/watch?v=IobYjhdAlH0)
- **13 min**: [https://www.youtube.com/watch?v=K-8c0ETmTvg](https://www.youtube.com/watch?v=K-8c0ETmTvg) (used as 10-min test)
- **20 min**: [https://www.youtube.com/watch?v=UFXiFfj058U](https://www.youtube.com/watch?v=UFXiFfj058U)
- **40 min**: [https://www.youtube.com/watch?v=5J2WGVrspd8](https://www.youtube.com/watch?v=5J2WGVrspd8)

### 2. Test Script (`scripts/test-analysis-pipeline.ts`)

Comprehensive test script that:
- ✅ Runs actual analysis on real YouTube videos
- ✅ Measures latency, cost, and observation rates
- ✅ Validates results against expected thresholds
- ✅ Generates detailed reports

### 3. NPM Scripts (added to `package.json`)

All test commands are now available via `npm run`.

---

## Before Running Tests

### 1. Ensure Environment is Configured

```bash
# Required environment variables
GEMINI_API_KEY=your_key_here
YOUTUBE_API_KEY=your_key_here  # Optional but recommended
ANALYSIS_MODE=gemini
ENABLE_ANALYSIS_V2_MULTIMODAL=true

# Optional: advanced pass caps (Tier 2)
MAX_ADVANCED_SEGMENTS=5
ADVANCED_SEGMENT_MAX_SECONDS=120
MAX_TIMELINE_POINTS=25
MAX_ADVANCED_PASS_COST_USD=0.25
MAX_ADVANCED_PASS_DURATION_MS=180000
```

### 2. Check Database

```bash
# Ensure Prisma is set up
npm run prisma:migrate
```

---

## Running Tests

### Test All Videos

```bash
npm run test:pipeline
```

**What it does:**
- Tests all 4 videos sequentially
- Reports pass/fail for each
- Generates summary by duration bucket
- Saves detailed results to `scripts/test-results.json`

**Expected output:**
```
===========================================
  CreatorSight Analysis Pipeline Tests
===========================================

Videos to test: 4
Buckets: short, medium, long, extended
Analysis mode: gemini
Advanced metrics: enabled

  Testing: Test: 5-Minute Short Video
  URL: https://www.youtube.com/watch?v=IobYjhdAlH0
  Duration: 300s (short)
  ✓ PASS in 1.2m | 87% observed | $0.082

  Testing: Test: 13-Minute Medium Video
  URL: https://www.youtube.com/watch?v=K-8c0ETmTvg
  Duration: 780s (medium)
  ✓ PASS in 2.4m | 85% observed | $0.124

===========================================
  SUMMARY
===========================================

SHORT BUCKET: 1/1 passed
  Avg latency: 1.2m
  Avg observed: 87.0%
  Total cost: $0.082

MEDIUM BUCKET: 1/1 passed
  Avg latency: 2.4m
  Avg observed: 85.0%
  Total cost: $0.124

-------------------------------------------
OVERALL: 4/4 passed (100%)
Total cost: $0.456
Avg latency: 2.1m
-------------------------------------------

Results written to: scripts/test-results.json
```

### Test a Specific Video

```bash
# Test just the 20-minute video
npm run test:pipeline:20min
```

**Good for:**
- Debugging a specific video length
- Quick validation after code changes
- Cost control (only runs 1 video)

### Test by Duration Bucket

```bash
# Test all short videos (< 3 min)
npm run test:pipeline:short

# Test all medium videos (3-10 min)
npm run test:pipeline:medium

# Test all long videos (10-20 min)
npm run test:pipeline:long
```

### Dry Run (No API Calls)

```bash
npm run test:pipeline -- --dry-run
```

Shows what would be tested without actually running analysis. Free and fast.

### Verbose Mode

```bash
npm run test:pipeline -- --verbose
```

Shows detailed results table with all metrics.

---

## Understanding Test Results

### Pass/Fail Criteria

A test **PASSES** if:
- ✅ Analysis completes without exceptions
- ✅ Core metrics observation rate ≥ 75%
- ✅ At least 3 beats detected
- ✅ All 6 domain profiles exist

A test **FAILS** if:
- ❌ Exception during analysis
- ❌ Observation rate < 75%
- ❌ Missing domain profiles

### Warnings (Not Failures)

- ⚠️ Observation rate 75-85% (target is 85%+)
- ⚠️ Fewer than 3 beats detected
- ⚠️ Not all chapters analyzed

### What Gets Measured

| Metric | Description | Good Threshold |
|--------|-------------|----------------|
| **Latency** | Total time to complete | < 3min for 10min video |
| **Observed %** | % of metrics with data | > 85% |
| **Cost** | Estimated Gemini API cost | < $0.15 for 10min video |

---

## Golden Set (Advanced Metrics)

Use the golden set to validate advanced metrics coverage, timelines, and baseline drift:

```bash
# Run full golden set (advanced metrics on)
npm run golden:multimodal

# Use tiered core-only mode (skips advanced metrics)
npm run golden:multimodal -- --tiered

# Use tiered core + selective advanced pass (Tier 2)
npm run golden:multimodal -- --selective-advanced

# Override minimum observation thresholds
npm run golden:multimodal -- --min-tier1-observed 90 --min-tier2-observed 75

# Override max timeline points for validation
npm run golden:multimodal -- --max-timeline-points 25

# Compare insights + timeline signal with/without advanced metrics
npm run golden:advanced-value
```

Notes:
- The golden set enforces Tier 2 observation rate and timeline size limits when advanced metrics are enabled.
- Use `--selective-advanced` to validate the selective Tier 2 pass from Stability Iteration 3.
- Baseline comparisons use `scripts/golden-set.baseline.v1.3.0.json` unless overridden.
| **Gemini Calls** | Number of API requests | ~6-8 for 10min video |

---

## Expected Results by Video Length

### 5-Minute Video
| Metric | Target | Acceptable |
|--------|--------|------------|
| Latency | < 90s | < 120s |
| Observed | > 90% | > 85% |
| Cost | < $0.08 | < $0.12 |

### 10-13 Minute Video
| Metric | Target | Acceptable |
|--------|--------|------------|
| Latency | < 180s | < 240s |
| Observed | > 85% | > 80% |
| Cost | < $0.12 | < $0.18 |

### 20-Minute Video
| Metric | Target | Acceptable |
|--------|--------|------------|
| Latency | < 300s | < 360s |
| Observed | > 85% | > 75% |
| Cost | < $0.20 | < $0.30 |

### 40-Minute Video
| Metric | Target | Acceptable |
|--------|--------|------------|
| Latency | < 420s | < 600s |
| Observed | > 80% | > 70% |
| Cost | < $0.35 | < $0.50 |

---

## Test Results File

After running tests, check `scripts/test-results.json`:

```json
{
  "timestamp": "2026-01-17T18:30:00.000Z",
  "summary": {
    "passed": 4,
    "total": 4,
    "passRate": 1.0,
    "totalCostUsd": 0.456,
    "avgLatencyMs": 126000
  },
  "results": [
    {
      "videoId": "test_short_5min",
      "success": true,
      "totalLatencyMs": 72000,
      "observedMetricsPct": 87.5,
      "estimatedCostUsd": 0.082,
      "geminiCalls": 5,
      "errors": [],
      "warnings": []
    }
  ]
}
```

---

## Troubleshooting

### Test Fails: "Could not analyze this URL"

**Cause**: YouTube API key invalid or video unavailable

**Fix**:
```bash
# Check environment
echo $YOUTUBE_API_KEY
# Verify video is public/unlisted
curl "https://www.youtube.com/watch?v=IobYjhdAlH0"
```

### Test Fails: Low Observation Rate

**Cause**: Gemini returning "unobserved" for many metrics

**Common reasons:**
- Video is silent (voice metrics fail)
- Video is static images (visual metrics fail)
- Video language not English (NLP fails)

**Fix**: Check `diagnostics.unobservedCounts` in results

### Test Times Out

**Cause**: Video too long or Gemini API slow

**Fix**:
```bash
# Increase timeout in config
export GEMINI_MULTIMODAL_TIMEOUT_MS=120000
```

### All Tests Fail: "ANALYSIS_MODE must be gemini"

**Cause**: Wrong analysis mode

**Fix**:
```bash
export ANALYSIS_MODE=gemini
export ENABLE_ANALYSIS_V2_MULTIMODAL=true
```

---

## Adding New Test Videos

1. **Edit `scripts/test-videos.json`**:

```json
{
  "id": "test_your_video",
  "youtubeId": "YOUR_VIDEO_ID",
  "youtubeUrl": "https://www.youtube.com/watch?v=YOUR_VIDEO_ID",
  "title": "Your Test Video",
  "durationSeconds": 600,
  "bucket": "medium",
  "type": "tutorial",
  "expectedChapters": 5,
  "notes": "Special test case"
}
```

2. **Run it**:

```bash
npm run test:pipeline -- --video=test_your_video
```

---

## What to Look For

### ✅ Good Signs
- Latency within expected range
- Observation rate > 85%
- Cost reasonable for video length
- Beats detected (3+)
- All 6 domains have profiles

### ⚠️ Warning Signs
- Observation rate 75-85%
- Latency approaching max threshold
- Only 1-2 beats detected
- Some unobserved metrics

### ❌ Bad Signs
- Observation rate < 75%
- Timeout or exception
- No beats detected
- Missing domain profiles
- Cost > 2x expected

---

## Cost Estimates

Based on current Gemini pricing (Flash model):

| Video Length | API Calls | Input Tokens | Output Tokens | Cost |
|--------------|-----------|--------------|---------------|------|
| 5 min | 4-5 | ~50K | ~3K | $0.06-0.10 |
| 10 min | 6-7 | ~80K | ~5K | $0.10-0.15 |
| 20 min | 8-10 | ~140K | ~8K | $0.18-0.28 |
| 40 min | 12-15 | ~240K | ~12K | $0.32-0.48 |

**Note**: Actual costs depend on:
- Video complexity (more cuts = more to describe)
- Content type (screencast vs vlog)
- Advanced metrics enabled/disabled
- Retry attempts

---

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/analysis-tests.yml
name: Analysis Tests

on:
  push:
    paths:
      - 'src/lib/analysis/**'
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - run: npm ci
      - name: Run 5-min test
        run: npm run test:pipeline:5min
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
      
      - name: Run 10-min test
        run: npm run test:pipeline:10min
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: scripts/test-results.json
```

---

## Next Steps

After running tests successfully:

1. **Review the comprehensive refactor docs**:
   - `docs/creatorsight-stability-refactor.md` - Full architecture plan
   - `docs/prompt-templates.md` - All Gemini prompts
   - `docs/schema-migration-v2.md` - Schema changes
   - `docs/testing-strategy.md` - Detailed testing approach

2. **Implement the tiered architecture** (from refactor doc):
   - Tier 0: Structure pass (skeleton)
   - Tier 1: Core metrics (per-chapter, no timelines)
   - Tier 2: Advanced metrics (selective)
   - Tier 3: Derived scores (local computation)

3. **Monitor key metrics over time**:
   - Pass rate per bucket
   - Average latency trends
   - Cost per video trends
   - Observation rate changes

---

## Summary

**You now have:**
✅ 4 test videos configured (5, 13, 20, 40 minutes)
✅ Comprehensive test script
✅ NPM commands for easy testing
✅ Automated validation and reporting
✅ Cost and latency tracking

**To validate the current system:**
```bash
npm run test:pipeline
```

**To test after changes:**
```bash
npm run test:pipeline:10min  # Quick validation
```

**To stress test:**
```bash
npm run test:pipeline:40min  # Long video
```
