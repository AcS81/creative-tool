# CreatorSight Stability Refactor: Layered Analysis Architecture

## Document Information
- **Product**: CreatorSight
- **Purpose**: Refactor analysis pipeline for stability, scalability, and progressive depth
- **Status**: Proposal
- **Target Outcome**: Reliable analysis for videos of any length with graceful degradation

---

## Executive Summary

The current analysis pipeline attempts to extract 50+ metrics in parallel, causing failures on longer videos and inconsistent coverage. This document proposes a **4-tier layered architecture** that:

1. Extracts video structure first (skeleton pass)
2. Computes robust core metrics per chapter
3. Adds advanced metrics only where valuable
4. Derives cross-modal and summary scores from observed data

The result: faster time-to-first-result, predictable costs, and no more all-or-nothing failures.

---

## Part 1: What Needs to Change

### 1.1 Current Architecture Problems

| Problem | Impact | Evidence |
|---------|--------|----------|
| **All-at-once extraction** | Long videos fail or return mostly unobserved | Core pass requests 23 metrics + beats + devices simultaneously |
| **No structural foundation** | Metrics lack context; beats often misclassified | Jump straight to scores without understanding video shape |
| **Timeline explosion** | Output token limits hit; truncated data | Every advanced metric requests full-video timelines |
| **Metric drift** | PRD, registry, axis metadata disagree | `story_presence` in narrative and language; `pattern_interrupts` in narrative and editing |
| **No progressive fallback** | One failure tanks entire analysis | If advanced pass fails, no partial results saved |
| **Unused analytics fields** | Wasted API calls | `relativeRetentionPerformance`, `averageViewPercentage` fetched but never surfaced |

### 1.2 Metric Inventory (Current State)

**Source files with metrics:**
- `metricRegistry.ts` — canonical base + advanced sections
- `axisMetadata.ts` — UI labels + supplemental axes
- `axes_and_domains.md` — glossary definitions
- `prd.md` — original spec (some unimplemented)
- `iteration_6_metric_semantics.md` — advanced metric definitions

**Drift examples:**
| Metric | Location A | Location B | Issue |
|--------|------------|------------|-------|
| `story_presence` | `narrative` domain | `language` domain | Duplicate |
| `pattern_interrupts` | `narrative` axes | `editing` axes | Different meanings |
| `warmth` | `SUPPLEMENTAL_METRICS.voice` | `axisMetadata.ts` | Not in core |
| `music_mood` | PRD | Not implemented | Missing |
| `emotional_tone` | PRD | Not implemented | Missing |

### 1.3 Missing Capabilities

| Category | What's Missing |
|----------|----------------|
| **Audio quality** | Noise floor, clipping, reverb, mic distance |
| **Visual quality** | Lighting, framing, focus, stabilization |
| **On-screen content** | Text/graphics detection, caption accuracy |
| **Performance signals** | Gaze contact, gesture frequency, posture |
| **Content credibility** | Claim density, source quality, novelty |
| **Accessibility** | Jargon density, signposting clarity |

---

## Part 2: Why It Needs to Change

### 2.1 Stability

**Current failure mode**: A 20-minute video causes the Gemini call to hit token limits or timeout. The entire analysis fails. User sees nothing.

**Target state**: Structure pass succeeds in seconds. Core metrics succeed per-chapter. Advanced metrics fill in progressively. User always sees something useful.

### 2.2 Scalability

**Current cost model**: Every video gets the same massive prompt regardless of length or complexity. A 2-minute video and a 45-minute video cost similarly.

**Target state**: Short videos get full analysis cheaply. Long videos get structure + core quickly, advanced only where valuable.

### 2.3 Quality

**Current issue**: Beats and metrics lack context. The model doesn't know if it's analyzing a tutorial, essay, vlog, or reaction video. Generic prompts produce generic results.

**Target state**: Structure pass identifies video type, chapters, and key moments. Core and advanced passes use this context to produce genre-appropriate analysis.

### 2.4 Maintainability

**Current issue**: Metrics are defined in 5+ places with inconsistent names and semantics. Adding a new metric requires touching schema, types, prompts, defaults, mocks, validators, and UI.

**Target state**: Single source of truth (`metricRegistry.ts`) generates everything. Adding a metric = adding one entry.

---

## Part 3: How It Needs to Change

### 3.1 New Architecture: 4-Tier Layered Analysis

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TIER 0: STRUCTURE PASS (always runs, fast, cheap)                       │
│ • Video skeleton: chapters, scenes, key moments                         │
│ • Content classification: type, topic, format                           │
│ • Transcript with timestamps                                            │
│ • Analysis plan: which chunks need which metrics                        │
│ Output: VideoSkeleton (~500 tokens)                                     │
│ Cost: ~$0.01-0.02                                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ TIER 1: CORE METRICS (always runs, per-chapter, no timelines)          │
│ • Voice: pace, filler, loudness, pitch, clarity                         │
│ • Language: concreteness, humor, teaching, references                   │
│ • Narrative: beat roles (from skeleton), structure clarity              │
│ • Visual: cut rate, stability, expression                               │
│ • Sound: music coverage, SFX density                                    │
│ Output: CoreMetrics per chapter + aggregated (~1000 tokens)             │
│ Cost: ~$0.05-0.10                                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ TIER 2: ADVANCED METRICS (selective, only high-value segments)         │
│ • Prosody: pace variability, energy drift, emphasis alignment           │
│ • Language texture: compression, humor timing, audience address         │
│ • Narrative arc: hook strength, cohesion drift, resolution              │
│ • Visual/edit: entropy, cut refinement, silence spans                   │
│ Output: Timelines/spans for selected segments (~500-1500 tokens each)   │
│ Cost: ~$0.02-0.05 per segment                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ TIER 3: DERIVED SCORES (computed locally, no API call)                  │
│ • Meta axes: voiceIntensity, conceptualDepth, etc.                      │
│ • Cross-modal alignment: audio-visual, beats-edits, prosody-semantic    │
│ • Modality balance: redundancy, over-reliance                           │
│ • Cognitive load: aggregated from tier 1+2 signals                      │
│ • Second-order: alignment, drift, decay, balance, timing                │
│ Output: DerivedScores (~200 tokens)                                     │
│ Cost: $0 (local computation)                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Tier 0: Structure Pass (New)

**Purpose**: Understand what we're analyzing before measuring anything.

**Implementation**: New file `src/lib/analysis/structurePass.ts`

**Schema**:
```typescript
interface VideoSkeleton {
  // Basic info
  durationSeconds: number;
  videoType: 'tutorial' | 'essay' | 'vlog' | 'reaction' | 'interview' | 'documentary' | 'entertainment' | 'other';
  topicSummary: string; // 2-3 sentences
  
  // Structure
  chapters: Array<{
    id: string;
    title: string;
    startSeconds: number;
    endSeconds: number;
    summary: string; // 1 sentence
    chapterType: 'intro' | 'hook' | 'body' | 'example' | 'tangent' | 'conclusion' | 'cta' | 'outro';
  }>;
  
  // Key moments (sparse, not full beats)
  keyMoments: Array<{
    type: 'hook' | 'peak' | 'twist' | 'payoff' | 'cta';
    timestamp: number;
    chapterId: string;
    description: string; // 10 words max
  }>;
  
  // Content composition
  contentMix: {
    talkingHeadPct: number;
    brollPct: number;
    graphicsPct: number;
    screencastPct: number;
    otherPct: number;
  };
  
  // Analysis hints
  analysisHints: {
    hasMusic: boolean;
    hasSFX: boolean;
    hasOnScreenText: boolean;
    hasMultipleSpeakers: boolean;
    primaryLanguage: string;
    estimatedComplexity: 'low' | 'medium' | 'high';
  };
}
```

**Prompt** (kept minimal):
```
Analyze this video's STRUCTURE. No metrics or scores.

Return JSON:
{
  "durationSeconds": number,
  "videoType": "tutorial"|"essay"|"vlog"|"reaction"|"interview"|"documentary"|"entertainment"|"other",
  "topicSummary": "2-3 sentence summary of what this video is about",
  "chapters": [
    {
      "id": "ch1",
      "title": "string",
      "startSeconds": number,
      "endSeconds": number,
      "summary": "1 sentence",
      "chapterType": "intro"|"hook"|"body"|"example"|"tangent"|"conclusion"|"cta"|"outro"
    }
  ],
  "keyMoments": [
    { "type": "hook"|"peak"|"twist"|"payoff"|"cta", "timestamp": number, "chapterId": "ch1", "description": "10 words max" }
  ],
  "contentMix": { "talkingHeadPct": number, "brollPct": number, "graphicsPct": number, "screencastPct": number, "otherPct": number },
  "analysisHints": { "hasMusic": boolean, "hasSFX": boolean, "hasOnScreenText": boolean, "hasMultipleSpeakers": boolean, "primaryLanguage": string, "estimatedComplexity": "low"|"medium"|"high" }
}

Rules:
- 3-7 chapters, evenly covering the video
- If YouTube provides chapters, use those titles
- keyMoments: only 3-5 most important moments
- All descriptions under 15 words
- JSON only, no prose
```

**Duration-based behavior**:
| Video Length | Chapter Count | Key Moments |
|--------------|---------------|-------------|
| < 3 min | 3-4 | 2-3 |
| 3-10 min | 4-5 | 3-4 |
| 10-20 min | 5-6 | 4-5 |
| > 20 min | 6-7 | 5 |

### 3.3 Tier 1: Core Metrics (Simplified)

**Purpose**: Get robust scores for every video, every time.

**Changes from current**:
1. Remove all `timeline`, `spans`, `items` arrays
2. Remove beat detection (use skeleton's chapters + keyMoments)
3. Run per-chapter, then aggregate
4. Shorter prompt, use skeleton context

**Schema** (simplified):
```typescript
interface CoreMetrics {
  // Voice domain
  voice: {
    speakingRate: SummaryMetric;      // "145 wpm, moderate"
    fillerRate: SummaryMetric;         // "2.3/min, low"
    pauseUsage: SummaryMetric;         // "frequent, deliberate"
    loudnessRange: SummaryMetric;      // "moderate dynamic range"
    pitchVariation: SummaryMetric;     // "varied, expressive"
    clarity: SummaryMetric;            // "clear articulation"
    warmth: SummaryMetric;             // "warm, conversational"
  };
  
  // Language domain
  language: {
    concreteness: SummaryMetric;       // "mostly concrete, some abstract"
    metaphorDensity: SummaryMetric;    // "occasional metaphors"
    references: SummaryMetric;         // "few cultural references"
    humor: SummaryMetric;              // "light humor throughout"
    teachingVsRiffing: SummaryMetric;  // "structured teaching"
    storyPresence: SummaryMetric;      // "narrative framing"
  };
  
  // Narrative domain (from skeleton)
  narrative: {
    structureClarity: SummaryMetric;   // "clear 3-act structure"
    hookPresence: SummaryMetric;       // "strong opening hook"
    transitionQuality: SummaryMetric;  // "smooth transitions"
    payoffDelivery: SummaryMetric;     // "satisfying conclusion"
  };
  
  // Visual domain
  visual: {
    cutRate: SummaryMetric;            // "4.2s avg between cuts"
    environmentStability: SummaryMetric; // "single setup"
    movement: SummaryMetric;           // "minimal camera movement"
    expression: SummaryMetric;         // "expressive, engaged"
  };
  
  // Sound domain
  sound: {
    musicCoverage: SummaryMetric;      // "30% with background music"
    musicBalance: SummaryMetric;       // "music understated"
    sfxDensity: SummaryMetric;         // "occasional SFX for emphasis"
    silenceUsage: SummaryMetric;       // "silence for beats"
  };
}

interface SummaryMetric {
  score: number;      // 0-100
  value: string;      // human-readable summary
  observed: boolean;  // false if couldn't measure
}
```

**Per-chapter execution**:
```typescript
// For a 15-minute video with 5 chapters:
const chapterMetrics = await Promise.all(
  skeleton.chapters.map(chapter => 
    analyzeChapterCore({
      youtubeUrl,
      startSeconds: chapter.startSeconds,
      endSeconds: chapter.endSeconds,
      chapterContext: chapter,
      videoContext: skeleton,
    })
  )
);

// Aggregate with duration weighting
const aggregated = aggregateCoreMetrics(chapterMetrics, skeleton.chapters);
```

**Prompt** (per chapter, uses skeleton context):
```
Analyze this chapter of a ${skeleton.videoType} video.

Video context: "${skeleton.topicSummary}"
Chapter: "${chapter.title}" (${chapter.chapterType})
Time range: ${chapter.startSeconds}s - ${chapter.endSeconds}s

Return JSON with scores (0-100) and short descriptions for:
- voice: speakingRate, fillerRate, pauseUsage, loudnessRange, pitchVariation, clarity, warmth
- language: concreteness, metaphorDensity, references, humor, teachingVsRiffing, storyPresence
- narrative: structureClarity, hookPresence, transitionQuality, payoffDelivery
- visual: cutRate, environmentStability, movement, expression
- sound: musicCoverage, musicBalance, sfxDensity, silenceUsage

Format: { "domain": { "metric": { "score": number, "value": "short description", "observed": boolean } } }
Mark observed:false if you cannot confidently measure that metric.
JSON only.
```

### 3.4 Tier 2: Advanced Metrics (Selective)

**Purpose**: Add depth where it matters, skip where it doesn't.

**Selection logic**:
```typescript
interface AdvancedAnalysisPlan {
  segments: Array<{
    chapterId: string;
    startSeconds: number;
    endSeconds: number;
    metricsToAnalyze: AdvancedMetricKey[];
    reason: string;
  }>;
}

function planAdvancedAnalysis(skeleton: VideoSkeleton, coreMetrics: CoreMetrics): AdvancedAnalysisPlan {
  const segments: AdvancedAnalysisPlan['segments'] = [];
  
  // Always analyze the hook chapter
  const hookChapter = skeleton.chapters.find(c => c.chapterType === 'hook' || c.chapterType === 'intro');
  if (hookChapter) {
    segments.push({
      chapterId: hookChapter.id,
      startSeconds: hookChapter.startSeconds,
      endSeconds: Math.min(hookChapter.endSeconds, hookChapter.startSeconds + 90), // Cap at 90s
      metricsToAnalyze: ['hookStrength', 'timeToHook', 'paceVariability', 'energyLevel'],
      reason: 'Hook analysis',
    });
  }
  
  // Analyze chapters with high cut rate or low clarity
  for (const chapter of skeleton.chapters) {
    const chapterCore = coreMetrics.perChapter?.[chapter.id];
    if (chapterCore?.visual.cutRate.score > 70) {
      segments.push({
        chapterId: chapter.id,
        startSeconds: chapter.startSeconds,
        endSeconds: chapter.endSeconds,
        metricsToAnalyze: ['visualEntropy', 'cutRefinement', 'cognitiveLoadSpikes'],
        reason: 'High cut rate chapter',
      });
    }
    if (chapterCore?.narrative.structureClarity.score < 50) {
      segments.push({
        chapterId: chapter.id,
        startSeconds: chapter.startSeconds,
        endSeconds: chapter.endSeconds,
        metricsToAnalyze: ['segmentCohesion', 'transitionClarity'],
        reason: 'Low structure clarity',
      });
    }
  }
  
  // Always analyze the conclusion
  const outroChapter = skeleton.chapters.find(c => c.chapterType === 'conclusion' || c.chapterType === 'outro');
  if (outroChapter) {
    segments.push({
      chapterId: outroChapter.id,
      startSeconds: outroChapter.startSeconds,
      endSeconds: outroChapter.endSeconds,
      metricsToAnalyze: ['endingResolution', 'openLoopsResolved', 'ctaClarity'],
      reason: 'Ending analysis',
    });
  }
  
  // Cap total segments
  return { segments: segments.slice(0, 5) };
}
```

**Advanced metrics available**:
```typescript
type AdvancedMetricKey =
  // Prosody
  | 'paceVariability'       // Timeline of pace changes
  | 'energyDrift'           // Energy trend over segment
  | 'emphasisAlignment'     // Stress on key phrases
  
  // Language texture
  | 'sentenceCompression'   // Words per idea
  | 'humorTiming'           // Setup-punch spacing
  | 'audienceAddress'       // You/we frequency
  | 'questionRate'          // Rhetorical vs genuine
  
  // Narrative arc
  | 'timeToHook'            // Seconds to first hook
  | 'hookStrength'          // Promise clarity
  | 'segmentCohesion'       // Drift between sections
  | 'openLoopsResolved'     // Dangling questions
  | 'endingResolution'      // Payoff completeness
  
  // Visual/edit
  | 'visualEntropy'         // Change rate timeline
  | 'cutRefinement'         // Cut pacing consistency
  | 'silenceSpans'          // Intentional quiet moments
  
  // Cognitive load
  | 'cognitiveLoadSpikes'   // High-load moments
  | 'loadDrivers';          // What causes spikes
```

**Prompt** (per segment, focused):
```
Analyze this segment for specific metrics.

Video: ${skeleton.videoType} about "${skeleton.topicSummary}"
Segment: "${chapter.title}" (${startSeconds}s - ${endSeconds}s)
Metrics requested: ${metricsToAnalyze.join(', ')}

For each metric, return:
- score: 0-100
- value: measurement with unit (e.g., "2.3 questions/min")
- timeline: array of {timeSeconds, value, label?} - MAX 20 POINTS
- observed: boolean

JSON only. If a metric cannot be measured, set observed:false.
```

**Timeline capping**:
```typescript
const maxTimelinePoints = (segmentDuration: number) => {
  if (segmentDuration <= 30) return 10;
  if (segmentDuration <= 60) return 15;
  if (segmentDuration <= 120) return 20;
  return 25; // Never more than 25 points
};
```

### 3.5 Tier 3: Derived Scores (Local Computation)

**Purpose**: Compute cross-modal alignment and summary scores without additional API calls.

**Implementation**: Extend `src/lib/analysis/fingerprint/secondOrder.ts`

**Scores to compute locally**:
```typescript
interface DerivedScores {
  // Meta axes (from core metrics)
  metaAxes: {
    voiceIntensity: number;           // avg(pace, loudness, pitch, energy)
    conceptualDepth: number;          // language abstractness + reference density
    narrativeStructureStrength: number; // hook + transitions + payoff
    visualDynamism: number;           // cut rate + movement + variety
    productionPolish: number;         // clarity + stability + music balance
  };
  
  // Cross-modal alignment (from tier 1 + tier 2)
  alignment: {
    audioVisualAlignment: number;     // Do voice peaks match edit peaks?
    beatsEditsAlignment: number;      // Do narrative beats align with cuts?
    prosodySemanticAlignment: number; // Are important words stressed?
    overallAlignment: number;         // Weighted average
  };
  
  // Modality balance
  balance: {
    redundancyScore: number;          // Do modes repeat info?
    complementarityScore: number;     // Do modes add unique info?
    overRelianceScore: number;        // Is one mode doing all the work?
    overallBalance: number;           // Weighted composite
  };
  
  // Cognitive load (aggregated)
  cognitiveLoad: {
    averageLoad: number;              // Mean load across video
    peakLoad: number;                 // Highest sustained load
    loadVariance: number;             // How much load fluctuates
    overloadMoments: number;          // Count of high-load spikes
  };
  
  // Second-order summary
  secondOrder: {
    alignmentScore: number;           // Cross-modal synchronization
    driftScore: number;               // Pace/energy stability
    decayScore: number;               // Late-video quality maintenance
    balanceScore: number;             // Modality complementarity
    timingScore: number;              // Hook/beat/silence effectiveness
  };
}

function computeDerivedScores(
  skeleton: VideoSkeleton,
  coreMetrics: CoreMetrics,
  advancedMetrics?: AdvancedMetrics
): DerivedScores {
  // All computation is local - no API calls
  // Uses only observed data from tier 1 + tier 2
}
```

**Computation rules**:
1. Only use metrics marked `observed: true`
2. If insufficient data, mark derived score as `observed: false`
3. Weight by chapter duration when aggregating
4. Normalize by video type (tutorials have different expectations than vlogs)

---

## Part 4: Migration Plan

### Phase 1: Add Structure Pass (3 days)

**Files to create**:
- `src/lib/analysis/structurePass.ts` — skeleton extraction logic
- `src/lib/analysis/types/skeleton.ts` — type definitions
- `src/lib/analysis/validators/skeleton.ts` — zod schema

**Files to modify**:
- `src/lib/analysis/service.ts` — add skeleton as first step
- `src/lib/analysis/jobs.ts` — add `structure` stage

**Tests**:
- Unit tests for skeleton extraction
- Golden set validation with known videos

### Phase 2: Simplify Core Pass (2 days)

**Files to modify**:
- `src/lib/analysis/geminiMultimodalAnalyzer.ts`:
  - Remove timeline/spans/items from core schema
  - Add per-chapter execution
  - Use skeleton context in prompts
- `src/lib/analysis/metricRegistry.ts`:
  - Mark metrics as `tier: 1 | 2 | 3`
  - Add `requiresTimeline: boolean`

**Files to create**:
- `src/lib/analysis/corePass.ts` — new simplified core logic
- `src/lib/analysis/aggregation.ts` — chapter aggregation utilities

### Phase 3: Implement Selective Advanced Pass (3 days)

**Files to create**:
- `src/lib/analysis/advancedPass.ts` — selective advanced extraction
- `src/lib/analysis/advancedPlanner.ts` — decides which segments need advanced

**Files to modify**:
- `src/lib/analysis/service.ts` — wire up advanced pass
- `src/lib/analysis/jobs.ts` — add `advanced` stage with segment tracking

### Phase 4: Consolidate Derived Scores (2 days)

**Files to modify**:
- `src/lib/analysis/fingerprint/secondOrder.ts`:
  - Expand to compute all derived scores
  - Add fallback logic for missing data
- `src/lib/schemas/fingerprint.ts`:
  - Update schema for new structure
  - Ensure backward compatibility

### Phase 5: Update UI & Cleanup (2 days)

**Files to modify**:
- Components displaying metrics: add observed/unobserved states
- Remove archetype/library comparison code (defer to later)
- Update `docs/axes_and_domains.md` to reflect new tier structure

---

## Part 5: Canonical Metric Registry (New)

### Single Source of Truth

All metrics defined in one place with full metadata:

```typescript
// src/lib/analysis/metricRegistry.ts (expanded)

interface MetricDefinition {
  id: string;
  domain: 'voice' | 'language' | 'narrative' | 'visual' | 'editing' | 'sound' | 'meta';
  tier: 1 | 2 | 3;
  
  // Display
  label: string;
  shortDescription: string;
  tooltip: string;
  
  // Measurement
  unit: string;                    // "wpm", "%", "count/min", etc.
  scaleDirection: string;          // "low=slow, high=fast"
  normalRange: [number, number];   // typical values
  
  // Data shape
  hasTimeline: boolean;
  hasSpans: boolean;
  hasItems: boolean;
  
  // Computation
  isDirectlyMeasured: boolean;     // false = derived from other metrics
  derivedFrom?: string[];          // metric IDs if derived
  
  // UI
  radarAxis: boolean;              // show on radar charts
  showInOverview: boolean;
  showInDomain: boolean;
}

export const METRIC_REGISTRY: Record<string, MetricDefinition> = {
  // === TIER 1: CORE (always measured) ===
  
  // Voice
  'voice.speakingRate': {
    id: 'voice.speakingRate',
    domain: 'voice',
    tier: 1,
    label: 'Speaking Pace',
    shortDescription: 'Words per minute',
    tooltip: 'How fast the speaker talks. 120-150 wpm is conversational, 150-180 is energetic.',
    unit: 'wpm',
    scaleDirection: 'low=slow, high=fast',
    normalRange: [100, 200],
    hasTimeline: false,
    hasSpans: false,
    hasItems: false,
    isDirectlyMeasured: true,
    radarAxis: true,
    showInOverview: true,
    showInDomain: true,
  },
  
  'voice.fillerRate': {
    id: 'voice.fillerRate',
    domain: 'voice',
    tier: 1,
    label: 'Filler Rate',
    shortDescription: 'Um/uh/like frequency',
    tooltip: 'Filler words per minute. Lower is more polished.',
    unit: 'per min',
    scaleDirection: 'low=polished, high=informal',
    normalRange: [0, 10],
    hasTimeline: false,
    hasSpans: false,
    hasItems: false,
    isDirectlyMeasured: true,
    radarAxis: true,
    showInOverview: false,
    showInDomain: true,
  },
  
  // ... (all other metrics defined similarly)
  
  // === TIER 2: ADVANCED (selective) ===
  
  'prosody.paceVariability': {
    id: 'prosody.paceVariability',
    domain: 'voice',
    tier: 2,
    label: 'Pace Variability',
    shortDescription: 'How much pace changes',
    tooltip: 'Coefficient of variation in speaking pace. Some variability is engaging; too much is chaotic.',
    unit: '%',
    scaleDirection: 'low=monotone, high=varied',
    normalRange: [10, 40],
    hasTimeline: true,  // Only tier 2+ have timelines
    hasSpans: false,
    hasItems: false,
    isDirectlyMeasured: true,
    radarAxis: false,
    showInOverview: false,
    showInDomain: true,
  },
  
  // === TIER 3: DERIVED (computed locally) ===
  
  'meta.voiceIntensity': {
    id: 'meta.voiceIntensity',
    domain: 'meta',
    tier: 3,
    label: 'Voice Intensity',
    shortDescription: 'Overall vocal energy',
    tooltip: 'Composite of pace, loudness, pitch variation.',
    unit: 'score',
    scaleDirection: 'low=calm, high=intense',
    normalRange: [30, 80],
    hasTimeline: false,
    hasSpans: false,
    hasItems: false,
    isDirectlyMeasured: false,
    derivedFrom: ['voice.speakingRate', 'voice.loudnessRange', 'voice.pitchVariation'],
    radarAxis: true,
    showInOverview: true,
    showInDomain: false,
  },
  
  'alignment.audioVisual': {
    id: 'alignment.audioVisual',
    domain: 'meta',
    tier: 3,
    label: 'Audio-Visual Alignment',
    shortDescription: 'Voice emphasis matches visual emphasis',
    tooltip: 'Do loud/stressed moments coincide with cuts, zooms, or graphics?',
    unit: 'score',
    scaleDirection: 'low=disconnected, high=synchronized',
    normalRange: [40, 90],
    hasTimeline: false,
    hasSpans: false,
    hasItems: false,
    isDirectlyMeasured: false,
    derivedFrom: ['prosody.emphasisAlignment', 'visual.cutRate', 'visual.entropy'],
    radarAxis: false,
    showInOverview: true,
    showInDomain: true,
  },
};

// Helper functions
export const getMetricsByTier = (tier: 1 | 2 | 3) => 
  Object.values(METRIC_REGISTRY).filter(m => m.tier === tier);

export const getMetricsByDomain = (domain: string) =>
  Object.values(METRIC_REGISTRY).filter(m => m.domain === domain);

export const getTier1Metrics = () => getMetricsByTier(1);
export const getTier2Metrics = () => getMetricsByTier(2);
export const getDerivedMetrics = () => getMetricsByTier(3);
```

---

## Part 6: Configuration & Feature Flags

### Environment Variables

```bash
# Analysis depth control
ANALYSIS_DEPTH=standard          # minimal | standard | full
ENABLE_STRUCTURE_PASS=true       # Enable tier 0
ENABLE_ADVANCED_METRICS=true     # Enable tier 2
ENABLE_DERIVED_SCORES=true       # Enable tier 3

# Per-tier controls
MAX_CHAPTERS_FOR_ADVANCED=5      # Limit advanced analysis
MAX_TIMELINE_POINTS=25           # Cap timeline arrays
ADVANCED_SEGMENT_MAX_SECONDS=120 # Max segment length for advanced

# Duration-based strategy
SHORT_VIDEO_THRESHOLD_SECONDS=180   # Under this = full analysis
MEDIUM_VIDEO_THRESHOLD_SECONDS=600  # Under this = standard
LONG_VIDEO_STRATEGY=structure_only  # structure_only | core_only | selective_advanced

# Cost controls
MAX_GEMINI_CALLS_PER_VIDEO=10    # Total API calls allowed
MAX_COST_PER_VIDEO_USD=0.50      # Abort if exceeding
```

### Runtime Strategy Selection

```typescript
interface AnalysisStrategy {
  runStructure: boolean;
  runCore: 'full' | 'per-chapter' | 'skip';
  runAdvanced: 'full' | 'selective' | 'skip';
  runDerived: boolean;
  maxAdvancedSegments: number;
  maxTimelinePoints: number;
}

function selectStrategy(durationSeconds: number, config: AppConfig): AnalysisStrategy {
  const depth = config.analysisDepth ?? 'standard';
  
  if (durationSeconds <= config.shortVideoThreshold) {
    return {
      runStructure: true,
      runCore: 'full',
      runAdvanced: depth === 'minimal' ? 'skip' : 'full',
      runDerived: true,
      maxAdvancedSegments: 10,
      maxTimelinePoints: 30,
    };
  }
  
  if (durationSeconds <= config.mediumVideoThreshold) {
    return {
      runStructure: true,
      runCore: 'per-chapter',
      runAdvanced: depth === 'minimal' ? 'skip' : 'selective',
      runDerived: true,
      maxAdvancedSegments: 5,
      maxTimelinePoints: 20,
    };
  }
  
  // Long video
  return {
    runStructure: true,
    runCore: 'per-chapter',
    runAdvanced: depth === 'full' ? 'selective' : 'skip',
    runDerived: true,
    maxAdvancedSegments: 3,
    maxTimelinePoints: 15,
  };
}
```

---

## Part 7: Error Handling & Fallbacks

### Graceful Degradation

```typescript
interface AnalysisResult {
  skeleton: VideoSkeleton;
  coreMetrics: CoreMetrics;
  advancedMetrics?: AdvancedMetrics;
  derivedScores: DerivedScores;
  
  // Observability
  diagnostics: {
    structurePass: PassResult;
    corePass: PassResult;
    advancedPasses: PassResult[];
    derivedComputation: ComputationResult;
    
    overallCoverage: {
      tier1Observed: number;  // % of tier 1 metrics observed
      tier2Observed: number;  // % of tier 2 metrics observed
      tier3Computed: number;  // % of tier 3 metrics computable
    };
    
    warnings: string[];
    errors: string[];
  };
}

interface PassResult {
  success: boolean;
  durationMs: number;
  tokensUsed: number;
  costUsd: number;
  errorMessage?: string;
  retryCount: number;
}
```

### Fallback Rules

1. **Structure pass fails**: Use duration-based default chapters, mark all keyMoments as unobserved
2. **Core pass fails for a chapter**: Mark that chapter's metrics as unobserved, continue with others
3. **Advanced pass fails**: Keep core metrics, mark advanced as unobserved
4. **Derived computation lacks inputs**: Mark that derived score as unobserved, compute what's possible

### Retry Logic

```typescript
const RETRY_CONFIG = {
  structure: { maxRetries: 2, backoffMs: 1000 },
  core: { maxRetries: 1, backoffMs: 500 },      // Per-chapter, so less critical
  advanced: { maxRetries: 1, backoffMs: 500 },  // Optional, so less critical
};

async function withRetry<T>(
  fn: () => Promise<T>,
  config: { maxRetries: number; backoffMs: number }
): Promise<T | null> {
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === config.maxRetries) {
        console.error(`All retries exhausted`, error);
        return null;
      }
      await sleep(config.backoffMs * (attempt + 1));
    }
  }
  return null;
}
```

---

## Part 8: UI Changes

### Progressive Loading

```
1. User submits URL
2. "Analyzing video structure..." (skeleton pass)
3. Skeleton complete → Show chapters, video type, topic summary
4. "Measuring core metrics..." (core pass per chapter)
5. Core complete → Show radar charts, domain scores
6. "Analyzing key moments..." (advanced pass, optional)
7. Advanced complete → Show timelines, detailed insights
8. "Computing insights..." (derived scores)
9. Complete → Show full analysis with coaching
```

### Observed/Unobserved States

Every metric display should handle:
- **Observed**: Show score + value + visualization
- **Unobserved**: Show "Not measured" chip with reason
- **Partially observed**: Show what's available with coverage indicator

### Deferred Features

Remove or hide until stability proven:
- Archetype classification
- Reference library comparison
- "Who you're most like" section
- Per-domain archetypes

Keep the data structures in schema for future use, but don't compute or display.

---

## Part 9: Success Metrics

### Stability Targets

| Metric | Current | Target |
|--------|---------|--------|
| Analysis completion rate (< 5 min videos) | ~95% | 99% |
| Analysis completion rate (5-15 min videos) | ~80% | 95% |
| Analysis completion rate (> 15 min videos) | ~60% | 85% |
| Time to first result | 30-60s | < 15s |
| Average cost per video | $0.30-0.80 | $0.10-0.30 |
| Core metrics coverage | 70% | 95% |

### Quality Targets

| Metric | Target |
|--------|--------|
| Tier 1 metrics observed | > 90% of videos |
| Tier 2 metrics observed (when requested) | > 75% of segments |
| Tier 3 metrics computable | > 85% when tier 1+2 available |
| Golden set accuracy | Maintain current thresholds |

---

## Part 10: Timeline

| Week | Focus | Deliverables |
|------|-------|--------------|
| 1 | Structure pass | `structurePass.ts`, types, tests |
| 2 | Core simplification | Per-chapter execution, no timelines |
| 3 | Advanced selection | Planner, targeted extraction |
| 4 | Derived scores | Local computation, fallbacks |
| 5 | Integration & UI | Progressive loading, observed states |
| 6 | Testing & tuning | Golden set, cost optimization |

---

## Appendix A: Full Metric List by Tier

### Tier 1: Core (23 metrics)

**Voice (7)**
- speakingRate, fillerRate, pauseUsage, loudnessRange, pitchVariation, clarity, warmth

**Language (6)**
- concreteness, metaphorDensity, references, humor, teachingVsRiffing, storyPresence

**Narrative (4)**
- structureClarity, hookPresence, transitionQuality, payoffDelivery

**Visual (4)**
- cutRate, environmentStability, movement, expression

**Sound (4)**
- musicCoverage, musicBalance, sfxDensity, silenceUsage

### Tier 2: Advanced (17 metrics)

**Prosody (4)**
- paceVariability, paceWithinSegment, emphasisAlignment, energyDrift

**Language Texture (5)**
- sentenceCompression, humorTiming, audienceAddress, questionRate, referenceDensity

**Narrative Arc (4)**
- timeToHook, hookStrength, segmentCohesion, openLoopsResolved, endingResolution

**Visual/Edit (4)**
- visualEntropy, cutRefinement, silenceSpans, beatEditAlignment

### Tier 3: Derived (15 metrics)

**Meta Axes (5)**
- voiceIntensity, conceptualDepth, narrativeStructureStrength, visualDynamism, productionPolish

**Alignment (4)**
- audioVisualAlignment, beatsEditsAlignment, prosodySemanticAlignment, overallAlignment

**Balance (3)**
- redundancyScore, complementarityScore, overRelianceScore

**Second-Order (5)**
- alignmentScore, driftScore, decayScore, balanceScore, timingScore

---

## Appendix B: Prompt Templates

See separate file: `docs/prompt-templates.md` (to be created)

---

## Appendix C: Schema Migration

See separate file: `docs/schema-migration-v2.md` (to be created)
