# CreatorSight – Stability Iteration 3: Selective Advanced Pass (Tier 2)

## Document Information
- **Product**: CreatorSight
- **Iteration**: Stability 3 – Selective Advanced Pass ("Depth Where It Matters")
- **Version**: 1.0
- **Status**: Ready for Implementation
- **Target Outcome**: A selective advanced metrics system that:
  - Only analyzes high-value segments (hooks, conclusions, problem areas)
  - Adds timelines and spans only where beneficial
  - Keeps costs predictable by capping segments analyzed
  - Provides actionable depth without overwhelming the model

> Stability Iteration 3 = "add depth where it matters, skip where it doesn't"

---

## High-level Scope

From the stability refactor PRD, this iteration implements **Tier 2: Advanced Metrics**:

- `advancedPass.ts` for selective advanced extraction
- `advancedPlanner.ts` for deciding which segments need analysis
- Timeline capping and segment length limits
- Integration with core metrics to guide selection
- Tier 2 uses existing v1.3 advanced metric sections selectively; cognitive load + modality balance are derived in Tier 3

Files to create:
- `src/lib/analysis/advancedPass.ts`
- `src/lib/analysis/advancedPlanner.ts`
- `src/lib/analysis/types/advancedMetrics.ts`

Files to modify:
- `src/lib/analysis/service.ts`
- `src/lib/analysis/jobs.ts`

---

## Phase 0: Advanced Metrics Types & Planning

### Task 0.1: Define Advanced Metric Types

**Context**

- Stability Refactor Part 3.4: Tier 2 schema
- Advanced metrics include timelines, unlike Tier 1

**Goals**

- [x] Create `src/lib/analysis/types/advancedMetrics.ts` with:
  - `AdvancedSegmentType` union: `'hook' | 'prosody_language' | 'visual_edit' | 'narrative_arc' | 'ending'`
  - `TimelinePoint` interface: `{ timeSeconds: number, value: number, label?: string }`
  - `RichMetric` interface (align with v1.3 `ScoredMetric`): `score`, `value`, `observed`, optional `timeline`, `spans`, `items`, `counts`, `proportions`, `trend`
  - `SegmentAdvancedMetrics` interface:
    - `segmentId: string`
    - `chapterId: string`
    - `startSeconds: number`
    - `endSeconds: number`
    - `segmentType: AdvancedSegmentType`
    - Sectioned metrics (optional, match v1.3 schema):
      - `prosodyArc?: Partial<ProsodyArc>`
      - `languageTexture?: Partial<LanguageTexture>`
      - `narrativeArc?: Partial<NarrativeArc>`
      - `visualEditAlignment?: Partial<VisualEditAlignment>`
- [x] Align Tier 2 metric set to existing v1.3 sections (selective per segment):
  - Hook (`hook`):
    - `narrativeArc.timeToHookSeconds`
    - `narrativeArc.hookStrengthScore`
    - `prosodyArc.paceVariabilityPct`
    - `prosodyArc.energyDriftDbPerMin` (map from hook "energyLevel")
  - Prosody/Language (`prosody_language`):
    - `prosodyArc.paceVariabilityPct`
    - `prosodyArc.withinSegmentPaceChangePct`
    - `prosodyArc.emphasisAlignmentScore`
    - `prosodyArc.energyDriftDbPerMin`
    - `languageTexture.sentenceCompressionRatio`
    - `languageTexture.humorTimingScore`
    - `languageTexture.audienceAddressFrequency`
    - `languageTexture.questionRate`
  - Visual/Edit (`visual_edit`):
    - `visualEditAlignment.visualEntropy`
    - `visualEditAlignment.cutRateRefinement`
    - `visualEditAlignment.silenceForEmphasisFidelity`
    - `visualEditAlignment.beatsVsEditsAlignment`
  - Narrative Arc (`narrative_arc`):
    - `narrativeArc.segmentCohesionDrift`
    - `narrativeArc.openLoopsUnresolvedRatio` (map from openLoops prompt)
  - Ending (`ending`):
    - `narrativeArc.endingResolutionScore`
    - `openLoopsResolved` used for diagnostics only (no new schema field)
- [x] Move `modalityBalance` and `cognitiveLoad` to Tier 3 derived scores (Iteration 4); keep defaults in Tier 2

**Constraints**

- Timeline arrays capped: ≤30s segment = 10 points, ≤60s = 15, ≤120s = 20, >120s = 25
- Each metric must be independently observable

**Acceptance Criteria**

- [x] Types compile and are JSON-serializable
- [x] Sectioned metrics align with existing v1.3 fingerprint schema
- [x] Timeline point limits documented in types
- [x] Cognitive load and modality balance are not part of Tier 2 types

---

### Task 0.2: Create Advanced Analysis Planner

**Context**

- Stability Refactor Part 3.4: Selection logic
- Smart selection reduces cost while maintaining insight

**Goals**

- [x] Create `src/lib/analysis/advancedPlanner.ts` with:
  - `AdvancedAnalysisPlan` interface:
    - `segments: SegmentPlan[]`
    - `totalEstimatedCost: number`
    - `reason: string`
  - `SegmentPlan` interface:
    - `chapterId: string`
    - `startSeconds: number`
    - `endSeconds: number`
    - `segmentType: AdvancedSegmentType`
    - `reason: string`
    - `priority: 'high' | 'medium' | 'low'`
  - `planAdvancedAnalysis(skeleton, coreMetrics, config): AdvancedAnalysisPlan`
- [x] Implement selection rules from refactor doc:
  - Always analyze hook chapter (segmentType `hook`)
  - If hook chapter duration > 120s, analyze only the first 90 seconds
  - Always analyze conclusion (segmentType `ending`)
  - Analyze chapters with high cut rate (>70 score) for visual metrics
  - Analyze chapters with low structure clarity (<50 score) for cohesion metrics
  - Skip chapters with very low observed % from core (`observedPct < 40`)
  - Prioritize by value: hooks > conclusions > problem areas
  - Sort by priority and cap at `maxSegments` (default 5)
  - Cap total segments at 5 (configurable)

**Constraints**

- Planning should be deterministic given same inputs
- Each segment capped at 120 seconds (hook cap at 90 seconds)
- One segmentType per segment plan (no mixed prompts)

**Acceptance Criteria**

- [x] Planner selects hook and conclusion consistently
- [x] Problem chapters trigger relevant metric analysis
- [x] Hook segments are capped at 90s when chapters are long
- [x] Low-observation chapters are skipped
- [x] Segment count stays within cap
- [ ] Unit tests for various video structures

---

## Phase 1: Advanced Pass Implementation

### Task 1.1: Create Advanced Segment Analysis Function

**Context**

- Stability Refactor Part 3.4: Per-segment advanced extraction

**Goals**

- [x] Create `src/lib/analysis/advancedPass.ts` with:
  - `analyzeSegmentAdvanced(input: SegmentAdvancedInput): Promise<SegmentAdvancedMetrics>`
  - Input includes: youtubeUrl, segment bounds, segmentType, video context
  - Uses Gemini with the prompt template matching `segmentType`
  - Returns sectioned metrics with timelines
- [x] Implement prompts from `docs/stabelversion/prompt-templates.md`:
  - Uses videoType and segment context
  - Requests timelines with duration-based caps (10/15/20/25)
  - Instructs observed:false when unable to measure

**Constraints**

- One Gemini call per segment (~$0.02-0.05 each)
- Timeout: 60 seconds per segment
- Timeline points must be within segment bounds

**Acceptance Criteria**

- [x] Segment analysis returns valid advanced metrics
- [x] Timelines are appropriately sized
- [x] observed:false used when metrics can't be measured
- [x] Unit tests with mocked Gemini

---

### Task 1.2: Implement Timeline Capping Logic

**Context**

- Stability Refactor Part 3.4: Timeline capping rules

**Goals**

- [x] Add `capTimeline(timeline: TimelinePoint[], segmentDuration: number): TimelinePoint[]`:
  - Apply duration-based limits
  - Use intelligent sampling if over limit (not just truncation)
  - Preserve first and last points
  - Preserve local maxima/minima
- [x] Add `maxTimelinePoints(segmentDuration: number): number`:
  - ≤30s: 10 points
  - ≤60s: 15 points
  - ≤120s: 20 points
  - >120s: 25 points

**Constraints**

- Capping should preserve signal shape
- No timeline should exceed 25 points

**Acceptance Criteria**

- [x] Timelines capped to correct size
- [x] Important points preserved
- [x] Unit tests for capping logic

---

### Task 1.3: Orchestrate Advanced Pass Execution

**Context**

- Running multiple segment analyses with rate limiting

**Goals**

- [x] Add `executeAdvancedPass(plan: AdvancedAnalysisPlan, input: AdvancedPassInput): Promise<AdvancedPassResult>`:
  - Execute segment analyses sequentially by default
  - Consider limited parallelism only for short videos (<5 min) as a later optimization
  - Collect results, handle partial failures
  - Track cost and timing
- [x] Add `AdvancedPassResult` type:
  - `segments: SegmentAdvancedMetrics[]`
  - `diagnostics: { segmentsPlanned, segmentsCompleted, segmentsFailed, totalDurationMs, estimatedCostUsd }`
- [x] Implement timeout and cost guards:
  - Abort if total pass exceeds 3 minutes
  - Abort if estimated cost exceeds threshold
- [x] Add `AdvancedPassConfig` and guard logic:
  - `maxSegments: number`
  - `maxCostUsd: number`
  - `maxDurationMs: number`

Implementation sketch (sequential with guards):
```ts
const results: SegmentAdvancedMetrics[] = [];
let totalCost = 0;
const startedAt = Date.now();

for (const segment of plan.segments) {
  const estimatedSegmentCost = estimateSegmentCost(segment);
  if (totalCost + estimatedSegmentCost > config.maxCostUsd) break;
  if (Date.now() - startedAt > config.maxDurationMs) break;

  try {
    const result = await analyzeSegmentAdvanced({ segment, timeoutMs: 60000 });
    results.push(result);
    totalCost += estimatedSegmentCost;
  } catch (error) {
    // Log and continue
  }
}
```

**Constraints**

- Partial results better than no results
- Must not exceed rate limits

**Acceptance Criteria**

- [x] Multiple segments analyzed correctly
- [x] Partial failures handled gracefully
- [x] Diagnostics track all metrics
- [x] Cost and time guards working

---

## Phase 2: Integration with Pipeline

### Task 2.1: Add Advanced Stage to Analysis Jobs

**Context**

- Stability Refactor Part 4 Phase 3: Advanced pass integration

**Goals**

- [x] Modify `src/lib/analysis/jobs.ts`:
  - Extend existing `'advanced'` stage behavior
  - Advanced stage runs after core, is optional
  - Store advanced metrics in job state
- [x] Add job state fields:
  - `advancedPlan?: AdvancedAnalysisPlan`
  - `advancedMetrics?: SegmentAdvancedMetrics[]`
  - `advancedDiagnostics?: AdvancedPassDiagnostics`

**Constraints**

- Advanced pass failure should not fail the job
- Advanced can be skipped via config

**Acceptance Criteria**

- [x] Jobs progress through advanced stage
- [x] Advanced results persisted
- [x] Skip logic works when disabled

---

### Task 2.2: Integrate Advanced Pass into Service

**Context**

- Stability Refactor Part 3.1: 4-tier flow

**Goals**

- [x] Modify `src/lib/analysis/service.ts`:
  - After core pass, call planner to create advanced plan
  - Execute advanced pass based on plan
  - Include advanced metrics in result
- [x] Update `AnalyzeVideoResult`:
  - Add `advancedMetrics?: SegmentAdvancedMetrics[]`
  - Add `diagnostics.advancedPass: PassResult`
- [x] Update fingerprint building:
  - Merge advanced metrics into fingerprint where applicable
  - Mark which sections have advanced data

**Constraints**

- Advanced pass is optional and configurable
- Fingerprint should work without advanced data

**Acceptance Criteria**

- [x] Advanced pass runs when enabled
- [x] Results included in fingerprint
- [x] Diagnostics complete
- [x] Tests cover with/without advanced

---

### Task 2.3: Map Advanced Metrics to Existing Schema

**Context**

- Maintain backward compatibility with existing fingerprint consumers

**Goals**

- [x] Create mapping from new advanced metrics to existing fingerprint fields:
  - Map segmentType outputs into v1.3 sections (`prosodyArc`, `languageTexture`, `narrativeArc`, `visualEditAlignment`)
  - Preserve per-segment metrics for diagnostics (do not overwrite with defaults when observed)
  - Do not merge timelines across segments; pick a primary segment per metric
- [x] Update fingerprint builder:
  - Accept optional advanced metrics
  - Merge intelligently with core metrics
  - Maintain schema version compatibility

**Constraints**

- Existing fingerprint schema must not break
- UI should work with or without advanced data

**Acceptance Criteria**

- [x] Advanced data appears in fingerprint
- [x] Fingerprint validates
- [x] UI displays advanced data when available

---

### Task 2.4: Define Mapping Examples and Timeline Handling

**Context**

- Mapping is the highest-risk compatibility step for v1.3 consumers

**Goals**

- [x] Add explicit mapping rules with examples:
  - Hook segment:
    - `narrativeArc.timeToHookSeconds` from hook prompt timeToHook
    - `narrativeArc.hookStrengthScore` from hook prompt hookStrength
    - `prosodyArc.paceVariabilityPct` from hook paceVariability
    - `prosodyArc.energyDriftDbPerMin` from hook energyLevel
  - Prosody/Language segment:
    - Map all prosody metrics into `prosodyArc.*`
    - Map all language metrics into `languageTexture.*`
  - Visual/Edit segment:
    - Map visual metrics into `visualEditAlignment.*`
  - Narrative arc segment:
    - Map cohesion/open loops into `narrativeArc.segmentCohesionDrift` and `narrativeArc.openLoopsUnresolvedRatio`
  - Ending segment:
    - Map to `narrativeArc.endingResolutionScore`
    - Use `openLoopsResolved` for diagnostics only (do not create new schema field)
- [x] Timeline handling:
  - Do not aggregate timelines across segments
  - Choose a primary segment per metric (priority: hook > ending > problem areas)
  - Keep per-segment timelines in `supporting.advancedSegments` (optional, non-breaking) if preserving detail
- [x] Score aggregation:
  - Duration-weighted average for scores when multiple segments provide the same metric
  - `observed: true` if any contributing segment observed the metric
  - Keep `value` from the primary segment to avoid concatenation
- [x] Add unit tests for mapping with multiple segments and missing data

**Acceptance Criteria**

- [x] Mapping rules are explicit and tested
- [x] Timelines remain within caps and are not merged
- [x] Missing segments fall back to defaults with `observed: false`

---

## Phase 3: Configuration & Testing

### Task 3.1: Add Configuration for Advanced Pass

**Context**

- Stability Refactor Part 6: Configuration

**Goals**

- [x] Add environment variables:
  - `ENABLE_ADVANCED_METRICS=true`
  - `MAX_ADVANCED_SEGMENTS=5`
  - `ADVANCED_SEGMENT_MAX_SECONDS=120`
  - `MAX_TIMELINE_POINTS=25`
  - `MAX_ADVANCED_PASS_COST_USD=0.25`
  - `MAX_ADVANCED_PASS_DURATION_MS=180000`
- [x] Update `src/lib/config.ts`:
  - Add advanced pass configuration
  - Add validation for segment/timeline limits
- [x] Add runtime strategy selection based on video length:
  - Short videos (< 3 min): full advanced
  - Medium videos (3-10 min): selective advanced
  - Long videos (> 10 min): minimal advanced or skip

**Acceptance Criteria**

- [x] Config flags control advanced behavior
- [x] Duration-based strategy works
- [x] Documentation updated

---

### Task 3.2: Golden Set Validation for Advanced Metrics

**Context**

- Stability Refactor Part 9: Quality targets

**Goals**

- [x] Update golden set tests:
  - Verify advanced metrics observed when requested
  - Check timeline quality for hook/conclusion
  - Validate metric accuracy against baseline
- [x] Target metrics:
  - >75% of segments return observed advanced metrics
  - Timelines within size limits
  - No regressions in hook analysis

**Acceptance Criteria**

- [x] Golden set includes advanced metric expectations
- [x] Tests pass with tiered analysis
- [x] Quality targets met

---

### Task 3.3: Cost and Performance Testing

**Context**

- Predictable costs are a key goal

**Goals**

- [x] Add cost tracking:
  - Log estimated cost per segment
  - Track total advanced pass cost
  - Compare to targets
- [x] Target costs:
  - Per segment: ~$0.02-0.05
  - Total advanced pass: ~$0.10-0.25
- [x] Add performance tests:
  - Advanced pass completes in < 3 minutes
  - No rate limit errors under normal use

**Acceptance Criteria**

- [x] Cost tracking implemented
- [x] Costs within target range
- [x] Performance acceptable

---

### Task 3.4: Validate Advanced Metrics Add Value

**Context**

- Ensure Tier 2 improves insight quality rather than adding noise

**Goals**

- [x] Compare analyses with and without advanced metrics on the golden set
- [x] Verify advanced metrics contribute actionable insights (not just extra timelines)
- [x] Spot-check timelines for signal (not flat noise)

**Acceptance Criteria**

- [x] Advanced metrics change at least one insight per video where enabled
- [x] Timeline signals are non-trivial (not constant/empty)

---

## Phase Transition Checklist (Stability Iteration 3)

### ✅ Phase 0 – Types & Planning
- [x] Advanced metric types defined
- [x] Planner selects segments correctly

### ✅ Phase 1 – Advanced Pass
- [x] Segment analysis working
- [x] Timeline capping implemented
- [x] Orchestration handles partial failures

### ✅ Phase 2 – Integration
- [x] Jobs include advanced stage
- [x] Service uses advanced pass
- [x] Fingerprint includes advanced data
- [x] Mapping rules documented and tested

### ✅ Phase 3 – Configuration & Testing
- [x] Config flags working
- [x] Golden set validated
- [x] Costs within targets
- [x] Advanced metrics value validated

---

## Summary

**Stability Iteration 3 Objective**: Implement Tier 2 (Advanced Metrics) where:
- Planner decides which segments need deep analysis
- Hook and conclusion always analyzed
- Problem areas get targeted metrics
- Timelines capped for predictable costs
- Partial failures don't tank the analysis
- Foundation set for derived scores in Iteration 4
