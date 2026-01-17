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

- [ ] Create `src/lib/analysis/types/advancedMetrics.ts` with:
  - `AdvancedMetricKey` type union (17 metrics listed in refactor doc)
  - `TimelinePoint` interface: `{ timeSeconds: number, value: number | string, label?: string }`
  - `AdvancedMetricResult` interface:
    - `key: AdvancedMetricKey`
    - `score: number` (0-100)
    - `value: string` (measurement with unit)
    - `timeline?: TimelinePoint[]` (max 20-25 points)
    - `observed: boolean`
  - `SegmentAdvancedMetrics` interface:
    - `segmentId: string`
    - `chapterId: string`
    - `startSeconds: number`
    - `endSeconds: number`
    - `metrics: Record<AdvancedMetricKey, AdvancedMetricResult>`
- [ ] Define metric groupings:
  - Prosody: paceVariability, energyDrift, emphasisAlignment
  - Language texture: sentenceCompression, humorTiming, audienceAddress, questionRate
  - Narrative arc: timeToHook, hookStrength, segmentCohesion, openLoopsResolved, endingResolution
  - Visual/edit: visualEntropy, cutRefinement, silenceSpans
  - Cognitive load: cognitiveLoadSpikes, loadDrivers

**Constraints**

- Timeline arrays capped: ≤30s segment = 10 points, ≤60s = 15, ≤120s = 20, >120s = 25
- Each metric must be independently observable

**Acceptance Criteria**

- [ ] Types compile and are JSON-serializable
- [ ] All 17 advanced metrics represented
- [ ] Timeline point limits documented in types

---

### Task 0.2: Create Advanced Analysis Planner

**Context**

- Stability Refactor Part 3.4: Selection logic
- Smart selection reduces cost while maintaining insight

**Goals**

- [ ] Create `src/lib/analysis/advancedPlanner.ts` with:
  - `AdvancedAnalysisPlan` interface:
    - `segments: SegmentPlan[]`
    - `totalEstimatedCost: number`
    - `reason: string`
  - `SegmentPlan` interface:
    - `chapterId: string`
    - `startSeconds: number`
    - `endSeconds: number`
    - `metricsToAnalyze: AdvancedMetricKey[]`
    - `reason: string`
    - `priority: 'high' | 'medium' | 'low'`
  - `planAdvancedAnalysis(skeleton, coreMetrics, config): AdvancedAnalysisPlan`
- [ ] Implement selection rules from refactor doc:
  - Always analyze hook chapter (hookStrength, timeToHook, paceVariability, energyLevel)
  - Always analyze conclusion (endingResolution, openLoopsResolved, ctaClarity)
  - Analyze chapters with high cut rate (>70 score) for visual metrics
  - Analyze chapters with low structure clarity (<50 score) for cohesion metrics
  - Cap total segments at 5 (configurable)

**Constraints**

- Planning should be deterministic given same inputs
- Each segment capped at 120 seconds
- No segment analyzed for more than 5 metrics

**Acceptance Criteria**

- [ ] Planner selects hook and conclusion consistently
- [ ] Problem chapters trigger relevant metric analysis
- [ ] Segment count stays within cap
- [ ] Unit tests for various video structures

---

## Phase 1: Advanced Pass Implementation

### Task 1.1: Create Advanced Segment Analysis Function

**Context**

- Stability Refactor Part 3.4: Per-segment advanced extraction

**Goals**

- [ ] Create `src/lib/analysis/advancedPass.ts` with:
  - `analyzeSegmentAdvanced(input: SegmentAdvancedInput): Promise<SegmentAdvancedMetrics>`
  - Input includes: youtubeUrl, segment bounds, metrics to analyze, video context
  - Uses Gemini with focused prompt per segment
  - Returns metrics with timelines
- [ ] Implement the prompt from refactor doc Part 3.4:
  - Uses videoType and segment context
  - Specifies exactly which metrics to return
  - Requests timeline with MAX 20 points
  - Instructs observed:false when unable to measure

**Constraints**

- One Gemini call per segment (~$0.02-0.05 each)
- Timeout: 60 seconds per segment
- Timeline points must be within segment bounds

**Acceptance Criteria**

- [ ] Segment analysis returns valid advanced metrics
- [ ] Timelines are appropriately sized
- [ ] observed:false used when metrics can't be measured
- [ ] Unit tests with mocked Gemini

---

### Task 1.2: Implement Timeline Capping Logic

**Context**

- Stability Refactor Part 3.4: Timeline capping rules

**Goals**

- [ ] Add `capTimeline(timeline: TimelinePoint[], segmentDuration: number): TimelinePoint[]`:
  - Apply duration-based limits
  - Use intelligent sampling if over limit (not just truncation)
  - Preserve first and last points
  - Preserve local maxima/minima
- [ ] Add `maxTimelinePoints(segmentDuration: number): number`:
  - ≤30s: 10 points
  - ≤60s: 15 points
  - ≤120s: 20 points
  - >120s: 25 points

**Constraints**

- Capping should preserve signal shape
- No timeline should exceed 25 points

**Acceptance Criteria**

- [ ] Timelines capped to correct size
- [ ] Important points preserved
- [ ] Unit tests for capping logic

---

### Task 1.3: Orchestrate Advanced Pass Execution

**Context**

- Running multiple segment analyses with rate limiting

**Goals**

- [ ] Add `executeAdvancedPass(plan: AdvancedAnalysisPlan, input: AdvancedPassInput): Promise<AdvancedPassResult>`:
  - Execute segment analyses sequentially or with limited parallelism (2-3)
  - Collect results, handle partial failures
  - Track cost and timing
- [ ] Add `AdvancedPassResult` type:
  - `segments: SegmentAdvancedMetrics[]`
  - `diagnostics: { segmentsPlanned, segmentsCompleted, segmentsFailed, totalDurationMs, estimatedCostUsd }`
- [ ] Implement timeout and cost guards:
  - Abort if total pass exceeds 3 minutes
  - Abort if estimated cost exceeds threshold

**Constraints**

- Partial results better than no results
- Must not exceed rate limits

**Acceptance Criteria**

- [ ] Multiple segments analyzed correctly
- [ ] Partial failures handled gracefully
- [ ] Diagnostics track all metrics
- [ ] Cost and time guards working

---

## Phase 2: Integration with Pipeline

### Task 2.1: Add Advanced Stage to Analysis Jobs

**Context**

- Stability Refactor Part 4 Phase 3: Advanced pass integration

**Goals**

- [ ] Modify `src/lib/analysis/jobs.ts`:
  - Add `'advanced'` to job stages enum
  - Advanced stage runs after core, is optional
  - Store advanced metrics in job state
- [ ] Add job state fields:
  - `advancedPlan?: AdvancedAnalysisPlan`
  - `advancedMetrics?: SegmentAdvancedMetrics[]`
  - `advancedDiagnostics?: AdvancedPassDiagnostics`

**Constraints**

- Advanced pass failure should not fail the job
- Advanced can be skipped via config

**Acceptance Criteria**

- [ ] Jobs progress through advanced stage
- [ ] Advanced results persisted
- [ ] Skip logic works when disabled

---

### Task 2.2: Integrate Advanced Pass into Service

**Context**

- Stability Refactor Part 3.1: 4-tier flow

**Goals**

- [ ] Modify `src/lib/analysis/service.ts`:
  - After core pass, call planner to create advanced plan
  - Execute advanced pass based on plan
  - Include advanced metrics in result
- [ ] Update `AnalyzeVideoResult`:
  - Add `advancedMetrics?: SegmentAdvancedMetrics[]`
  - Add `diagnostics.advancedPass: PassResult`
- [ ] Update fingerprint building:
  - Merge advanced metrics into fingerprint where applicable
  - Mark which sections have advanced data

**Constraints**

- Advanced pass is optional and configurable
- Fingerprint should work without advanced data

**Acceptance Criteria**

- [ ] Advanced pass runs when enabled
- [ ] Results included in fingerprint
- [ ] Diagnostics complete
- [ ] Tests cover with/without advanced

---

### Task 2.3: Map Advanced Metrics to Existing Schema

**Context**

- Maintain backward compatibility with existing fingerprint consumers

**Goals**

- [ ] Create mapping from new advanced metrics to existing fingerprint fields:
  - Map timeline data to existing `spans` if present
  - Map scores to existing metric scores
  - Preserve data that doesn't fit in new items
- [ ] Update fingerprint builder:
  - Accept optional advanced metrics
  - Merge intelligently with core metrics
  - Maintain schema version compatibility

**Constraints**

- Existing fingerprint schema must not break
- UI should work with or without advanced data

**Acceptance Criteria**

- [ ] Advanced data appears in fingerprint
- [ ] Fingerprint validates
- [ ] UI displays advanced data when available

---

## Phase 3: Configuration & Testing

### Task 3.1: Add Configuration for Advanced Pass

**Context**

- Stability Refactor Part 6: Configuration

**Goals**

- [ ] Add environment variables:
  - `ENABLE_ADVANCED_METRICS=true`
  - `MAX_ADVANCED_SEGMENTS=5`
  - `ADVANCED_SEGMENT_MAX_SECONDS=120`
  - `MAX_TIMELINE_POINTS=25`
- [ ] Update `src/lib/config.ts`:
  - Add advanced pass configuration
  - Add validation for segment/timeline limits
- [ ] Add runtime strategy selection based on video length:
  - Short videos (< 3 min): full advanced
  - Medium videos (3-10 min): selective advanced
  - Long videos (> 10 min): minimal advanced or skip

**Acceptance Criteria**

- [ ] Config flags control advanced behavior
- [ ] Duration-based strategy works
- [ ] Documentation updated

---

### Task 3.2: Golden Set Validation for Advanced Metrics

**Context**

- Stability Refactor Part 9: Quality targets

**Goals**

- [ ] Update golden set tests:
  - Verify advanced metrics observed when requested
  - Check timeline quality for hook/conclusion
  - Validate metric accuracy against baseline
- [ ] Target metrics:
  - >75% of segments return observed advanced metrics
  - Timelines within size limits
  - No regressions in hook analysis

**Acceptance Criteria**

- [ ] Golden set includes advanced metric expectations
- [ ] Tests pass with tiered analysis
- [ ] Quality targets met

---

### Task 3.3: Cost and Performance Testing

**Context**

- Predictable costs are a key goal

**Goals**

- [ ] Add cost tracking:
  - Log estimated cost per segment
  - Track total advanced pass cost
  - Compare to targets
- [ ] Target costs:
  - Per segment: ~$0.02-0.05
  - Total advanced pass: ~$0.10-0.25
- [ ] Add performance tests:
  - Advanced pass completes in < 3 minutes
  - No rate limit errors under normal use

**Acceptance Criteria**

- [ ] Cost tracking implemented
- [ ] Costs within target range
- [ ] Performance acceptable

---

## Phase Transition Checklist (Stability Iteration 3)

### ✅ Phase 0 – Types & Planning
- [ ] Advanced metric types defined
- [ ] Planner selects segments correctly

### ✅ Phase 1 – Advanced Pass
- [ ] Segment analysis working
- [ ] Timeline capping implemented
- [ ] Orchestration handles partial failures

### ✅ Phase 2 – Integration
- [ ] Jobs include advanced stage
- [ ] Service uses advanced pass
- [ ] Fingerprint includes advanced data

### ✅ Phase 3 – Configuration & Testing
- [ ] Config flags working
- [ ] Golden set validated
- [ ] Costs within targets

---

## Summary

**Stability Iteration 3 Objective**: Implement Tier 2 (Advanced Metrics) where:
- Planner decides which segments need deep analysis
- Hook and conclusion always analyzed
- Problem areas get targeted metrics
- Timelines capped for predictable costs
- Partial failures don't tank the analysis
- Foundation set for derived scores in Iteration 4
