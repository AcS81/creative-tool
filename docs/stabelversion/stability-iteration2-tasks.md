# CreatorSight – Stability Iteration 2: Core Pass Simplification (Tier 1)

## Document Information
- **Product**: CreatorSight
- **Iteration**: Stability 2 – Core Pass Simplification ("Robust Per-Chapter Metrics")
- **Version**: 1.0
- **Status**: Ready for Implementation
- **Target Outcome**: A simplified core metrics pass that:
  - Runs per-chapter instead of full-video
  - Removes all timeline/spans/items arrays from core schema
  - Uses skeleton context for genre-appropriate analysis
  - Achieves >95% completion rate for videos up to 15 minutes

> Stability Iteration 2 = "get robust scores for every video, every time"

---

## High-level Scope

From the stability refactor PRD, this iteration implements **Tier 1: Core Metrics**:

- Simplified `CoreMetrics` schema without timelines
- Per-chapter execution with aggregation
- Use skeleton context in prompts
- Remove beat detection (use skeleton's chapters + keyMoments)

Files to create:
- `src/lib/analysis/corePass.ts`
- `src/lib/analysis/aggregation.ts`

Files to modify:
- `src/lib/analysis/geminiMultimodalAnalyzer.ts`
- `src/lib/analysis/metricRegistry.ts`
- `src/lib/analysis/service.ts`

---

## Phase 0: Simplified Core Schema

### Task 0.1: Define SummaryMetric Type

**Context**

- Stability Refactor Part 3.3: Tier 1 schema
- Core metrics should be simple score + description, no timelines

**Goals**

- [ ] Create or update `src/lib/analysis/types/coreMetrics.ts` with:
  - `SummaryMetric` interface:
    - `score: number` (0-100)
    - `value: string` (human-readable summary, e.g., "145 wpm, moderate")
    - `observed: boolean` (false if couldn't measure)
- [ ] Define `CoreMetrics` interface with domains:
  - `voice`: speakingRate, fillerRate, pauseUsage, loudnessRange, pitchVariation, clarity, warmth
  - `language`: concreteness, metaphorDensity, references, humor, teachingVsRiffing, storyPresence
  - `narrative`: structureClarity, hookPresence, transitionQuality, payoffDelivery
  - `visual`: cutRate, environmentStability, movement, expression
  - `sound`: musicCoverage, musicBalance, sfxDensity, silenceUsage
- [ ] Define `ChapterCoreMetrics` as CoreMetrics + chapterId

**Constraints**

- No `timeline`, `spans`, or `items` arrays in Tier 1
- Each metric must be measurable independently
- Schema must be compact (~1000 tokens total output)

**Acceptance Criteria**

- [ ] Types compile and are JSON-serializable
- [ ] No timeline/array fields in core schema
- [ ] Types exported from analysis types index

---

### Task 0.2: Update Metric Registry with Tiers

**Context**

- Stability Refactor Part 5: Canonical Metric Registry
- All metrics should be marked with their tier

**Goals**

- [ ] Modify `src/lib/analysis/metricRegistry.ts`:
  - Add `tier: 1 | 2 | 3` to metric definitions
  - Add `hasTimeline: boolean` field
  - Add `requiresTimeline: boolean` field
  - Mark Tier 1 metrics: all 23 core metrics
  - Mark Tier 2 metrics: 17 advanced metrics
  - Mark Tier 3 metrics: 15 derived metrics
- [ ] Add helper functions:
  - `getTier1Metrics(): MetricDefinition[]`
  - `getTier2Metrics(): MetricDefinition[]`
  - `getDerivedMetrics(): MetricDefinition[]`
  - `getMetricsByDomain(domain: string): MetricDefinition[]`

**Constraints**

- Backward compatible: existing metric lookups should still work
- Keep existing metric IDs for UI compatibility

**Acceptance Criteria**

- [ ] All metrics have tier assigned
- [ ] Helper functions return correct subsets
- [ ] Existing tests still pass
- [ ] No breaking changes to metric lookup

---

## Phase 1: Per-Chapter Core Analysis

### Task 1.1: Create Core Pass Function

**Context**

- Stability Refactor Part 3.3: Per-chapter execution
- Core pass uses skeleton context for better results

**Goals**

- [ ] Create `src/lib/analysis/corePass.ts` with:
  - `analyzeChapterCore(input: ChapterCoreInput): Promise<ChapterCoreMetrics>`
  - Input includes: youtubeUrl, startSeconds, endSeconds, chapterContext, videoContext (skeleton)
  - Uses Gemini with focused prompt per chapter
  - Returns `ChapterCoreMetrics` with all domain scores
- [ ] Implement the prompt from refactor doc Part 3.3:
  - Uses videoType and topicSummary for context
  - Asks for scores (0-100) and short descriptions
  - Specifies the exact metric list
  - Instructs to mark observed:false when uncertain

**Constraints**

- One Gemini call per chapter (~$0.02-0.03 each)
- Cap chapter analysis at 5 minutes of content
- Timeout: 45 seconds per chapter

**Acceptance Criteria**

- [ ] Chapter analysis returns valid CoreMetrics
- [ ] Context from skeleton improves relevance
- [ ] observed:false used appropriately
- [ ] Unit tests with mocked Gemini

---

### Task 1.2: Implement Parallel Chapter Analysis

**Context**

- Stability Refactor Part 3.3: Parallel execution for chapters

**Goals**

- [ ] Add `analyzeCoreMetrics(input: CorePassInput): Promise<CoreMetrics>`:
  - Takes skeleton and video URL
  - Runs `Promise.all` on chapter analyses
  - Handles partial failures gracefully
  - Returns aggregated CoreMetrics
- [ ] Add chapter batching for long videos:
  - Max 5 parallel Gemini calls
  - Queue additional chapters
  - Respect rate limits

**Constraints**

- Total core pass should complete in < 2 minutes for 7 chapters
- One chapter failure should not fail entire pass

**Acceptance Criteria**

- [ ] Parallel execution working for multi-chapter videos
- [ ] Partial failures handled gracefully
- [ ] Rate limiting prevents Gemini quota issues
- [ ] Performance acceptable for long videos

---

### Task 1.3: Create Aggregation Utilities

**Context**

- Stability Refactor Part 3.3: Aggregation with duration weighting

**Goals**

- [ ] Create `src/lib/analysis/aggregation.ts` with:
  - `aggregateCoreMetrics(chapters: ChapterCoreMetrics[], skeleton: VideoSkeleton): CoreMetrics`
  - Duration-weighted averaging for numeric scores
  - Combine observed flags (observed if majority observed)
  - Merge value descriptions appropriately
- [ ] Implement weighting strategy:
  - Weight by chapter duration (endSeconds - startSeconds)
  - Handle missing chapters (use other chapters' average)
  - Generate aggregate value descriptions

**Constraints**

- Aggregation must be deterministic
- Handle edge cases: single chapter, all unobserved, etc.

**Acceptance Criteria**

- [ ] Aggregation produces valid CoreMetrics
- [ ] Weights by duration correctly
- [ ] Handles partial observation
- [ ] Unit tests for aggregation logic

---

## Phase 2: Integration & Migration

### Task 2.1: Refactor Multimodal Analyzer for Tier 1

**Context**

- Stability Refactor Part 4 Phase 2: Core simplification
- Existing analyzer needs to use new core pass

**Goals**

- [ ] Modify `src/lib/analysis/geminiMultimodalAnalyzer.ts`:
  - Add `useTieredAnalysis: boolean` flag
  - When enabled: use skeleton + core pass instead of all-at-once
  - Remove timeline extraction from core pass
  - Keep existing path for backward compatibility (deprecated)
- [ ] Update `MultimodalAnalysisResult`:
  - Add `skeleton?: VideoSkeleton`
  - Add `coreMetrics?: CoreMetrics`
  - Add `perChapterMetrics?: ChapterCoreMetrics[]`

**Constraints**

- Existing behavior must remain available behind flag
- New path should be opt-in initially
- Both paths should produce compatible output shapes

**Acceptance Criteria**

- [ ] Tiered analysis produces valid results
- [ ] Existing tests still pass
- [ ] New tiered path tested separately
- [ ] Performance improved for long videos

---

### Task 2.2: Update Service to Use Tiered Analysis

**Context**

- Stability Refactor Part 4: Service integration

**Goals**

- [ ] Modify `src/lib/analysis/service.ts`:
  - Add config flag `useTieredAnalysis` (from env)
  - When enabled: call structure pass, then core pass
  - Build fingerprint from CoreMetrics instead of all-at-once
  - Include per-chapter data in supporting info
- [ ] Update `buildAnalysisFromMultimodal` or create new function:
  - `buildAnalysisFromTiered(skeleton, coreMetrics, options)`
  - Maps CoreMetrics to existing fingerprint domain profiles
  - Maintains compatibility with existing UI

**Constraints**

- Fingerprint output shape must not change (UI compatibility)
- diagnostics should indicate which path was used

**Acceptance Criteria**

- [ ] Tiered analysis produces valid fingerprints
- [ ] UI displays results correctly
- [ ] Diagnostics show tiered path info
- [ ] Config flag controls behavior

---

### Task 2.3: Remove Beat Detection from Core

**Context**

- Stability Refactor Part 3.3: Use skeleton's chapters + keyMoments instead

**Goals**

- [ ] Identify beat detection code in current analyzer
- [ ] Remove beat detection from core pass:
  - Beats now come from skeleton.keyMoments
  - Chapters provide structural context
  - Narrative metrics derived from skeleton structure
- [ ] Update any code that depends on beat detection:
  - Map keyMoments to expected beat format
  - Ensure narrative metrics still work

**Constraints**

- Beats in fingerprint should still be populated
- Format must match existing schema for UI

**Acceptance Criteria**

- [ ] Beat detection removed from core Gemini call
- [ ] Skeleton keyMoments used instead
- [ ] Fingerprint beats populated correctly
- [ ] Narrative metrics still accurate

---

## Phase 3: Testing & Validation

### Task 3.1: Core Pass Unit Tests

**Context**

- Testing quality of simplified core analysis

**Goals**

- [ ] Add tests for core pass:
  - Chapter analysis returns valid metrics
  - Aggregation produces expected results
  - Parallel execution handles errors
  - Observed flags work correctly
- [ ] Add tests for metric registry:
  - Tier helpers return correct metrics
  - No duplicates between tiers

**Acceptance Criteria**

- [ ] All new functions have unit tests
- [ ] Edge cases covered
- [ ] Tests run in CI

---

### Task 3.2: Golden Set Validation for Core Metrics

**Context**

- Stability Refactor Part 9: Quality Targets

**Goals**

- [ ] Update golden set tests:
  - Run tiered analysis on golden set videos
  - Compare core metrics to baseline
  - Verify >90% tier 1 metrics observed
- [ ] Add regression detection:
  - Flag significant metric deviations
  - Track observed rate over time

**Constraints**

- Tests should work with mocked Gemini in CI
- Real Gemini tests are manual

**Acceptance Criteria**

- [ ] Golden set passes with tiered analysis
- [ ] Tier 1 observed rate >90%
- [ ] No significant regressions from previous baseline

---

### Task 3.3: Performance Benchmarks

**Context**

- Stability Refactor Part 9: Stability Targets

**Goals**

- [ ] Add performance tests:
  - Time to complete core pass for various video lengths
  - API cost per video
  - Completion rate tracking
- [ ] Target metrics:
  - < 5 min video: >99% completion, ~$0.05-0.10 cost
  - 5-15 min video: >95% completion, ~$0.10-0.20 cost
  - 15+ min video: >85% completion, ~$0.15-0.30 cost

**Acceptance Criteria**

- [ ] Benchmarks documented
- [ ] Cost within target range
- [ ] Completion rate meets targets

---

## Phase Transition Checklist (Stability Iteration 2)

### ✅ Phase 0 – Simplified Schema
- [ ] SummaryMetric and CoreMetrics types defined
- [ ] Metric registry updated with tiers

### ✅ Phase 1 – Per-Chapter Analysis
- [ ] Chapter core analysis working
- [ ] Parallel execution implemented
- [ ] Aggregation utilities complete

### ✅ Phase 2 – Integration
- [ ] Multimodal analyzer supports tiered mode
- [ ] Service uses tiered analysis
- [ ] Beat detection removed from core

### ✅ Phase 3 – Testing
- [ ] Unit tests passing
- [ ] Golden set validated
- [ ] Performance benchmarks met

---

## Summary

**Stability Iteration 2 Objective**: Simplify Tier 1 (Core Metrics) where:
- Per-chapter analysis replaces all-at-once extraction
- No timelines/spans in core schema (moved to Tier 2)
- Skeleton context improves metric relevance
- Parallel execution with graceful partial failure
- >95% completion rate for videos up to 15 minutes
- Foundation set for selective advanced analysis in Iteration 3
