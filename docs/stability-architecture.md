# Stability Architecture: 4-Tier Analysis

## Overview

CreatorSight uses a **4-tier progressive analysis architecture** that delivers results incrementally while maximizing stability, cost efficiency, and time to first insight.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Request                             │
│                  (YouTube URL)                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Tier 0: Structure Pass (10-15s)                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  • Video type, duration, chapters                            │
│  • Key moments, content mix                                  │
│  • Analysis hints for subsequent tiers                       │
│  • Cost: ~$0.02-0.05                                        │
│                                                              │
│  ✓ UI Updates: Show video structure, chapters timeline      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Tier 1: Core Metrics Pass (20-30s)                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  • Per-chapter analysis of 5 domains                         │
│  • Voice, Language, Narrative, Visual, Sound                 │
│  • Aggregated to video-level summaries                       │
│  • Cost: ~$0.05-0.10                                        │
│                                                              │
│  ✓ UI Updates: Show radar chart, domain scores, insights    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Tier 2: Advanced Metrics Pass (30-60s)                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  • Segment-level deep analysis                               │
│  • Timeline data, arcs, patterns                             │
│  • Second-order metrics                                      │
│  • Cost: ~$0.08-0.15                                        │
│  • Response format options: full vs compact                  │
│                                                              │
│  ✓ UI Updates: Show advanced timelines, arc analysis        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Tier 3: Derived Scores (< 1s)                              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  • Computed from Tier 1 + Tier 2                            │
│  • Meta-axes, alignment, balance, cognitive load             │
│  • No API calls (local computation)                          │
│  • Cost: $0.00                                              │
│                                                              │
│  ✓ UI Updates: Complete fingerprint with all axes           │
└─────────────────────────────────────────────────────────────┘
```

## Tier Details

### Tier 0: Structure Pass (VideoSkeleton)

**Purpose:** Understand video structure before detailed analysis.

**Output Data Structure:**
```typescript
interface VideoSkeleton {
  durationSeconds: number;
  videoType: VideoType; // 'tutorial' | 'vlog' | 'review' | etc.
  topicSummary: string;
  chapters: Chapter[];
  keyMoments: KeyMoment[];
  contentMix: ContentMix; // % talking head, b-roll, graphics
  analysisHints: AnalysisHints; // guidance for later tiers
}
```

**Characteristics:**
- Fast: 10-15 seconds
- Lightweight: $0.02-0.05 per video
- Essential for intelligent chapter segmentation
- Enables early UI feedback

**Fallback Behavior:**
If structure pass fails, system generates a fallback skeleton with:
- Single chapter spanning entire video
- Generic video type
- No key moments
- Analysis continues with reduced context

---

### Tier 1: Core Metrics (Per-Chapter Analysis)

**Purpose:** Measure fundamental creative metrics across 5 domains.

**Output Data Structure:**
```typescript
interface CoreMetrics {
  voice: {
    pacing: SummaryMetric;           // 0-100, observed: boolean
    energyLevel: SummaryMetric;
    tonalVariety: SummaryMetric;
    // ... 6-8 metrics per domain
  };
  language: { /* ... */ };
  narrative: { /* ... */ };
  visual: { /* ... */ };
  sound: { /* ... */ };
}

interface SummaryMetric {
  score: number;      // 0-100
  value: string;      // Human-readable (e.g., "145 wpm, moderate")
  observed: boolean;  // False if couldn't measure
  reason?: string;    // Why unobserved
}
```

**Characteristics:**
- Per-chapter: Each chapter analyzed independently
- Aggregated: Chapter metrics combined to video-level
- Observed/Unobserved: Transparent about measurement success
- Coverage target: >90% of metrics observed

**Fallback Behavior:**
If a chapter fails analysis:
- Mark all metrics as `observed: false`
- Continue with remaining chapters
- Aggregate successfully analyzed chapters
- UI shows coverage indicators

---

### Tier 2: Advanced Metrics (Segment-Level)

**Purpose:** Detailed timeline analysis and second-order patterns.

**Output Data Structure:**
```typescript
interface AdvancedMetrics {
  // Per-segment timelines (5-8 segments per video)
  paceTimeline: TimelinePoint[];
  energyTimeline: TimelinePoint[];
  
  // Arc analysis
  paceVariabilityPct: ScoredMetric;
  narrativeArc: ScoredMetric;
  
  // Second-order metrics
  hookStrength: ScoredMetric;
  retentionCurve: ScoredMetric;
  peakMoment: ScoredMetric;
}
```

**Response Format Options:**

#### Full Mode (ADVANCED_RESPONSE_FORMAT=full)
- Complete timeline data for each metric
- Raw segment boundaries preserved
- Highest fidelity
- Higher latency (~60s)
- Recommended for: detailed coaching, forensic analysis

#### Compact Mode (ADVANCED_RESPONSE_FORMAT=compact)
- Interpolated timelines (5-7 points vs 20-30)
- Aggregated spans instead of fine-grained segments
- Lower latency (~30s)
- Lower cost (~40% reduction)
- Acceptable variance: <10% on derived scores
- Recommended for: production, general use

**Schema Strategy Options:**

#### Inherit (ADVANCED_SCHEMA_STRATEGY=inherit)
- Use Gemini's response_schema enforcement
- Stricter validation
- May fail if schema rejected by model
- Fallback to optional mode on rejection

#### Optional (ADVANCED_SCHEMA_STRATEGY=optional)
- Looser schema guidance
- Higher success rate
- Post-parse validation catches issues
- Recommended default

**Fallback Behavior:**
If advanced pass fails entirely:
- Video analysis still completes with Tier 0 + Tier 1
- Advanced metrics marked as unavailable
- UI shows "Basic analysis complete" status
- User can optionally retry for advanced features

---

### Tier 3: Derived Scores (Computed Locally)

**Purpose:** High-level interpretive scores computed from earlier tiers.

**Output Data Structure:**
```typescript
interface DerivedScores {
  metaAxes: MetaAxes;        // 8 high-level dimensions
  alignment: AlignmentScores; // Voice-visual sync, narrative-pacing
  balance: BalanceScores;     // Content type balance, pacing variety
  cognitiveLoad: CognitiveLoadScores; // Density, complexity
}
```

**Characteristics:**
- Instant: <1 second (local computation)
- Zero cost: No API calls
- Requires: At least Tier 1 data
- Enhanced by: Tier 2 timeline data when available

**Computation Logic:**
```
metaAxes.voiceIntensity = f(voice.pacing, voice.energyLevel, voice.tonalVariety)
metaAxes.visualDynamism = f(visual.cutRate, visual.motionLevel, visual.colorVibrancy)
alignment.voiceVisual = correlation(voice.energy, visual.dynamics)
```

---

## Progressive Loading & UI Updates

### Phase-by-Phase Updates

1. **Analysis Started**
   - Show loading state with estimated time
   - Display progress: Structure → Core → Advanced → Complete

2. **Structure Complete (10-15s)**
   - Render video structure visualization
   - Show chapters timeline
   - Display key moments
   - Show estimated complexity

3. **Core Complete (30-45s total)**
   - Render radar chart with domain scores
   - Show domain score bars
   - Display initial insights
   - Enable domain deep-dive views

4. **Advanced Complete (60-90s total)**
   - Show timeline visualizations
   - Display arc analysis
   - Enable advanced coaching
   - Show full performance profile

5. **Analysis Complete**
   - All metrics available
   - Full fingerprint generated
   - Export/share enabled

### Observation Status Indicators

Each metric displays its observation status:

- **✓ Observed** (green): Metric successfully measured
- **⚠ Partial** (yellow): Metric measured with reduced confidence
- **— Not Measured** (gray): Metric unavailable (with reason)

**Coverage Indicators:**
- Domain-level: "4/6 metrics observed (67%)"
- Video-level: "Overall coverage: 38/40 metrics (95%)"
- Warnings: Shown if domain coverage <50%

---

## Error Recovery & Fallback Strategy

### Cascading Fallbacks

```
Tier 0 fails → Use fallback skeleton → Continue
  └─> Tier 1 fails → Use fallback metrics → Mark unobserved
      └─> Tier 2 fails → Skip advanced → Complete basic analysis
          └─> Analysis completes with partial data
```

### Graceful Degradation Principles

1. **Never fail completely**: Every tier has a fallback
2. **Transparent limitations**: UI shows what's missing and why
3. **Partial success**: Some data is better than no data
4. **Retry-friendly**: User can re-run for better results

### Common Failure Scenarios

| Scenario | Impact | Recovery |
|----------|--------|----------|
| Structure timeout | No chapters | Single-chapter fallback, continue |
| Chapter too short | Core metrics fail | Mark chapter unobserved, skip |
| Advanced API quota | No timelines | Complete with basic analysis |
| Model overload | Intermittent failures | Retry logic with exponential backoff |
| Invalid response | Parse errors | Salvage mode extracts partial data |

---

## Configuration Guide

### Essential Config Variables

```bash
# Analysis Mode
ANALYSIS_VERSION=v2                    # Use tiered architecture
ENABLE_TIERED_ANALYSIS=true           # Enable 4-tier flow

# Structure Pass (Tier 0)
ENABLE_STRUCTURE_PASS=true            # Enable Tier 0
STRUCTURE_PASS_TIMEOUT_MS=30000       # 30s timeout

# Advanced Pass (Tier 2)
ENABLE_ADVANCED_METRICS=true          # Enable Tier 2
ADVANCED_RESPONSE_FORMAT=compact      # 'full' or 'compact'
ADVANCED_SCHEMA_STRATEGY=optional     # 'inherit', 'strict', or 'optional'
MAX_ADVANCED_SEGMENTS=5               # Segment budget
ADVANCED_SEGMENT_MAX_SECONDS=120      # Max segment length
MAX_TIMELINE_POINTS=25                # Timeline resolution
MAX_ADVANCED_PASS_COST_USD=0.25       # Cost cap per video
MAX_ADVANCED_PASS_DURATION_MS=180000  # 3 min timeout

# Feature Flags
SHOW_ARCHETYPE_FEATURES=false         # Hide archetype comparisons
SHOW_REFERENCE_LIBRARY=false          # Hide reference library
```

### Recommended Production Settings

**High Quality (Detailed Analysis)**
```bash
ADVANCED_RESPONSE_FORMAT=full
ADVANCED_SCHEMA_STRATEGY=inherit
MAX_ADVANCED_SEGMENTS=8
ADVANCED_SEGMENT_MAX_SECONDS=180
```

**Balanced (Default)**
```bash
ADVANCED_RESPONSE_FORMAT=compact
ADVANCED_SCHEMA_STRATEGY=optional
MAX_ADVANCED_SEGMENTS=5
ADVANCED_SEGMENT_MAX_SECONDS=120
```

**Fast & Cheap (Basic Analysis)**
```bash
ENABLE_ADVANCED_METRICS=false
# Only runs Tier 0 + Tier 1
```

---

## Performance Targets

### Completion Rates (by Video Length)

| Video Length | Target | Current |
|-------------|--------|---------|
| < 5 min     | >99%   | TBD     |
| 5-15 min    | >95%   | TBD     |
| > 15 min    | >85%   | TBD     |

### Latency Targets

| Tier | Target | Typical |
|------|--------|---------|
| Structure | <15s | 10-12s |
| Core | <30s | 20-25s |
| Advanced | <60s | 35-50s |
| Total | <90s | 60-75s |

### Cost Targets

| Configuration | Target | Typical |
|--------------|--------|---------|
| Basic (T0+T1) | $0.07-0.15 | $0.10 |
| Full (T0+T1+T2 full) | $0.15-0.30 | $0.22 |
| Compact (T0+T1+T2 compact) | $0.10-0.20 | $0.14 |

---

## Troubleshooting

### Issue: High Unobserved Rate

**Symptoms:** >10% of metrics marked as unobserved

**Causes:**
- Video quality issues (no audio, no visuals)
- Extreme video lengths (>30min)
- Niche content types (model unfamiliar)

**Solutions:**
1. Check video accessibility
2. Enable salvage mode for edge cases
3. Adjust segment strategy for long videos
4. Review model selection

### Issue: Structure Pass Timeouts

**Symptoms:** Analysis stuck at "Analyzing structure..."

**Causes:**
- Network latency
- Model overload
- Very long videos (>60min)

**Solutions:**
1. Increase `STRUCTURE_PASS_TIMEOUT_MS` to 45000
2. Use faster model for structure pass
3. Check API quotas

### Issue: Advanced Pass Failures

**Symptoms:** Analysis completes but "Advanced analysis unavailable"

**Causes:**
- Schema rejection (inherit mode)
- Cost limits exceeded
- Segment planning issues

**Solutions:**
1. Switch to `ADVANCED_SCHEMA_STRATEGY=optional`
2. Increase `MAX_ADVANCED_PASS_COST_USD`
3. Reduce `MAX_ADVANCED_SEGMENTS` to 3-4
4. Use `ADVANCED_RESPONSE_FORMAT=compact`

---

## Migration Notes

### From Old (All-at-Once) to New (Tiered)

**Breaking Changes:**
- None at API level
- UI now shows progressive updates
- Some timing characteristics changed

**Deprecated:**
- `analyzeVideoMultimodal` with `useTieredAnalysis=false`
- `runMultimodalCore` (all-at-once approach)

**Migration Path:**
1. Set `ENABLE_TIERED_ANALYSIS=true`
2. Test with sample videos
3. Adjust timeouts/budgets as needed
4. Monitor completion rates
5. Remove deprecated code references (planned for v2.0)

---

## Future Improvements

- **Tier 2 parallelization**: Run audio and visual segments in parallel
- **Smart segment planning**: Dynamic segment sizing based on video complexity
- **Incremental Tier 3**: Compute derived scores as Tier 2 segments complete
- **Caching**: Reuse structure/core data for re-analysis
- **Streaming**: WebSocket updates for real-time progress

---

## See Also

- [Axes and Domains Reference](./axes_and_domains.md)
- [E2E Testing Guide](./stability_e2e.md)
- [Golden Set Validation](../scripts/README.md)
- [Stability Refactor Plan](./stabelversion/creatorsight-stability-refactor.md)
