# CreatorSight – Stability Iteration 4: Derived Scores & Error Handling (Tier 3)

## Document Information
- **Product**: CreatorSight
- **Iteration**: Stability 4 – Derived Scores & Error Handling ("Local Computation & Graceful Degradation")
- **Version**: 1.0
- **Status**: Ready for Implementation
- **Target Outcome**: A derived scoring system that:
  - Computes cross-modal alignment and meta-scores locally (no API calls)
  - Falls back gracefully when input data is missing
  - Provides comprehensive error handling and diagnostics
  - Maintains quality even with partial observation

> Stability Iteration 4 = "compute insights from observed data, handle gaps gracefully"

---

## High-level Scope

From the stability refactor PRD, this iteration implements **Tier 3: Derived Scores**:

- Local computation of meta axes, alignment, balance, and cognitive load scores
- Fallback logic for missing Tier 1/2 data
- Comprehensive error handling and retry logic
- Pipeline-wide diagnostics and observability

Files to create:
- `src/lib/analysis/derivedScores.ts`
- `src/lib/analysis/errorHandling.ts`
- `src/lib/analysis/pipelineDiagnostics.ts`

Files to modify:
- `src/lib/analysis/fingerprint/secondOrder.ts`
- `src/lib/analysis/service.ts`
- `src/lib/schemas/fingerprint.ts`

---

## Phase 0: Derived Score Types & Computation

### Task 0.1: Define Derived Score Types

**Context**

- Stability Refactor Part 3.5: Tier 3 schema
- All Tier 3 scores computed locally from Tier 1 + Tier 2 data

**Goals**

- [ ] Create or extend `src/lib/analysis/types/derivedScores.ts` with:
  - `DerivedScores` interface containing:
    - `metaAxes`: voiceIntensity, conceptualDepth, narrativeStructureStrength, visualDynamism, productionPolish
    - `alignment`: audioVisualAlignment, beatsEditsAlignment, prosodySemanticAlignment, overallAlignment
    - `balance`: redundancyScore, complementarityScore, overRelianceScore, overallBalance
    - `cognitiveLoad`: averageLoad, peakLoad, loadVariance, overloadMoments
    - `secondOrder`: alignmentScore, driftScore, decayScore, balanceScore, timingScore
  - Each score has `value: number` (0-100) and `observed: boolean`
  - `DerivedScoreInput` type for computation inputs

**Constraints**

- All computation local—no Gemini calls
- Must work with partial Tier 1/2 data

**Acceptance Criteria**

- [ ] Types compile and match refactor spec
- [ ] All derived metrics represented
- [ ] observed flag supported for each

---

### Task 0.2: Implement Meta Axes Computation

**Context**

- Stability Refactor Part 3.5: Meta axes from core metrics

**Goals**

- [ ] Create `src/lib/analysis/derivedScores.ts` with:
  - `computeMetaAxes(coreMetrics: CoreMetrics): MetaAxes`
  - Formulas:
    - `voiceIntensity = avg(speakingRate.score, loudnessRange.score, pitchVariation.score)`
    - `conceptualDepth = weighted(concreteness.score, metaphorDensity.score, references.score)`
    - `narrativeStructureStrength = avg(structureClarity.score, hookPresence.score, payoffDelivery.score)`
    - `visualDynamism = avg(cutRate.score, movement.score, expression.score)`
    - `productionPolish = avg(clarity.score, environmentStability.score, musicBalance.score)`
  - Handle unobserved metrics: use available metrics only, mark axis observed if >50% inputs observed

**Constraints**

- Formulas should produce values in 0-100 range
- Weights should sum to 1

**Acceptance Criteria**

- [ ] Meta axes computed correctly from sample data
- [ ] Unobserved inputs handled gracefully
- [ ] Unit tests verify formulas

---

### Task 0.3: Implement Alignment Score Computation

**Context**

- Stability Refactor Part 3.5: Cross-modal alignment

**Goals**

- [ ] Add to `derivedScores.ts`:
  - `computeAlignmentScores(core: CoreMetrics, advanced?: AdvancedMetrics): AlignmentScores`
  - Metrics:
    - `audioVisualAlignment`: correlate voice emphasis with visual changes
    - `beatsEditsAlignment`: correlate narrative moments with cuts
    - `prosodySemanticAlignment`: correlate stress with important words
    - `overallAlignment`: weighted average
  - Use timeline data from Tier 2 when available
  - Fall back to heuristics from Tier 1 scores when Tier 2 missing

**Constraints**

- Must work without Tier 2 data (reduced accuracy)
- Correlation computation should be efficient

**Acceptance Criteria**

- [ ] Alignment scores computed from available data
- [ ] Works with and without Tier 2
- [ ] Unit tests for both scenarios

---

### Task 0.4: Implement Balance & Cognitive Load Scores

**Context**

- Stability Refactor Part 3.5: Modality balance and cognitive load

**Goals**

- [ ] Add to `derivedScores.ts`:
  - `computeBalanceScores(core: CoreMetrics, skeleton: VideoSkeleton): BalanceScores`
  - `computeCognitiveLoadScores(core: CoreMetrics, advanced?: AdvancedMetrics): CognitiveLoadScores`
  - Balance metrics:
    - `redundancyScore`: do modes repeat information?
    - `complementarityScore`: do modes add unique value?
    - `overRelianceScore`: is one mode doing all the work?
  - Cognitive load metrics:
    - `averageLoad`, `peakLoad`, `loadVariance`, `overloadMoments`
    - Use Tier 2 `cognitiveLoadSpikes` if available
- [ ] Implement `computeSecondOrderScores(all inputs)`:
  - Aggregate alignment, drift, decay, balance, timing

**Constraints**

- Cognitive load without Tier 2 data is estimated from Tier 1 signals
- Second-order scores aggregate all derived metrics

**Acceptance Criteria**

- [ ] Balance scores reasonable for sample data
- [ ] Cognitive load computed with/without Tier 2
- [ ] Second-order scores aggregate correctly

---

## Phase 1: Error Handling & Fallbacks

### Task 1.1: Create Error Handling Module

**Context**

- Stability Refactor Part 7: Graceful degradation

**Goals**

- [ ] Create `src/lib/analysis/errorHandling.ts` with:
  - `AnalysisError` class extending Error with:
    - `type: 'structure' | 'core' | 'advanced' | 'derived' | 'gemini' | 'timeout' | 'validation'`
    - `recoverable: boolean`
    - `fallbackAvailable: boolean`
  - `withRetry<T>(fn, config): Promise<T | null>` utility
  - `RetryConfig` type: `{ maxRetries, backoffMs, timeoutMs }`
- [ ] Define retry configurations per pass:
  - Structure: 2 retries, 1000ms backoff
  - Core (per chapter): 1 retry, 500ms backoff
  - Advanced (per segment): 1 retry, 500ms backoff

**Constraints**

- Retry should use exponential backoff
- Timeout errors should be caught and handled

**Acceptance Criteria**

- [ ] Error types cover all failure modes
- [ ] Retry logic works correctly
- [ ] Backoff timing correct

---

### Task 1.2: Implement Fallback Rules

**Context**

- Stability Refactor Part 7: Fallback rules

**Goals**

- [ ] Implement fallback generators:
  - `buildFallbackSkeleton(duration)`: duration-based default chapters
  - `buildFallbackCoreMetrics(skeleton)`: neutral scores with observed:false
  - `buildFallbackDerivedScores()`: neutral scores with observed:false
- [ ] Integrate fallbacks into pass functions:
  - Structure pass → fallback skeleton on failure
  - Core chapter → mark chapter unobserved, continue with others
  - Advanced segment → mark segment unobserved, continue
  - Derived computation → mark individual scores unobserved as needed

**Constraints**

- Fallback data must pass validation
- Fallbacks should be clearly marked in output

**Acceptance Criteria**

- [ ] All fallback generators produce valid data
- [ ] Passes use fallbacks on failure
- [ ] Output clearly indicates fallback usage

---

### Task 1.3: Implement Pipeline-Wide Error Recovery

**Context**

- Ensuring analysis always produces some result

**Goals**

- [ ] Modify analysis orchestration to:
  - Catch errors at each tier boundary
  - Log errors with full context
  - Continue to next tier with available data
  - Aggregate errors in diagnostics
- [ ] Add `AnalysisResult.diagnostics`:
  - `errors: AnalysisError[]`
  - `warnings: string[]`
  - `fallbacksUsed: string[]`
  - `overallSuccess: boolean` (true if any meaningful data returned)

**Constraints**

- No tier failure should crash the entire pipeline
- All errors should be logged for debugging

**Acceptance Criteria**

- [ ] Pipeline completes even with tier failures
- [ ] Diagnostics include all errors and fallbacks
- [ ] Logging provides debugging context

---

## Phase 2: Diagnostics & Observability

### Task 2.1: Create Pipeline Diagnostics Module

**Context**

- Stability Refactor Part 7: Observability

**Goals**

- [ ] Create `src/lib/analysis/pipelineDiagnostics.ts` with:
  - `PassResult` type: `{ success, durationMs, tokensUsed, costUsd, errorMessage?, retryCount }`
  - `PipelineDiagnostics` type aggregating all pass results
  - `buildPipelineDiagnostics(passes): PipelineDiagnostics`
- [ ] Add coverage computation:
  - `tier1Observed`: % of Tier 1 metrics observed
  - `tier2Observed`: % of Tier 2 metrics observed (when requested)
  - `tier3Computed`: % of Tier 3 metrics computable
- [ ] Add cost aggregation:
  - Total tokens, total cost, per-pass breakdown

**Constraints**

- Diagnostics should be computed efficiently
- All data should be JSON-serializable

**Acceptance Criteria**

- [ ] Diagnostics capture all pass results
- [ ] Coverage percentages accurate
- [ ] Cost tracking complete

---

### Task 2.2: Integrate Diagnostics into Service

**Context**

- Making diagnostics available in analysis result

**Goals**

- [ ] Modify `src/lib/analysis/service.ts`:
  - Collect PassResult from each tier
  - Build complete PipelineDiagnostics
  - Include in AnalyzeVideoResult
- [ ] Update `AnalyzeVideoResult.diagnostics`:
  - Add `structurePass`, `corePass`, `advancedPasses[]`, `derivedComputation`
  - Add `overallCoverage`
  - Add `totalCostUsd`, `totalDurationMs`

**Constraints**

- Existing diagnostic fields should remain for backward compatibility
- New fields are additive

**Acceptance Criteria**

- [ ] All diagnostic data in result
- [ ] Backward compatibility maintained
- [ ] UI can access diagnostics

---

### Task 2.3: Add Observability Logging

**Context**

- Production debugging and monitoring

**Goals**

- [ ] Enhance logging throughout pipeline:
  - Log pass start/end with timing
  - Log errors with full context
  - Log retry attempts
  - Log fallback activations
- [ ] Structure logs for observability:
  - Include videoId, passName, duration, success
  - Use consistent format for parsing

**Constraints**

- Don't log sensitive data
- Keep log volume reasonable

**Acceptance Criteria**

- [ ] All passes logged
- [ ] Errors include context
- [ ] Logs parseable for monitoring

---

## Phase 3: Integration & Schema Updates

### Task 3.1: Update Fingerprint Schema for Derived Scores

**Context**

- Stability Refactor Part 4 Phase 4: Schema updates

**Goals**

- [ ] Modify `src/lib/schemas/fingerprint.ts`:
  - Add `derivedScores?: DerivedScores` to fingerprint
  - Update Zod validation for new structure
  - Ensure backward compatibility (derived scores optional)
- [ ] Update fingerprint version:
  - Increment to indicate schema change
  - Add migration notes

**Constraints**

- Existing fingerprints without derived scores must still validate
- Version field must be updated

**Acceptance Criteria**

- [ ] Schema accepts derived scores
- [ ] Old fingerprints still valid
- [ ] Version incremented

---

### Task 3.2: Integrate Derived Computation into Service

**Context**

- Completing the 4-tier pipeline

**Goals**

- [ ] Modify `src/lib/analysis/service.ts`:
  - Add derived score computation after core/advanced
  - Call `computeDerivedScores(skeleton, coreMetrics, advancedMetrics)`
  - Include derived scores in fingerprint
- [ ] Handle missing inputs:
  - Compute what's possible
  - Mark unobservable scores

**Constraints**

- Derived computation should add negligible time
- Always run, even if advanced was skipped

**Acceptance Criteria**

- [ ] Derived scores computed in pipeline
- [ ] Fingerprint includes derived scores
- [ ] Works with partial Tier 1/2 data

---

### Task 3.3: Update Second-Order Module

**Context**

- Consolidating derived computation in existing module

**Goals**

- [ ] Modify `src/lib/analysis/fingerprint/secondOrder.ts`:
  - Import and use new derived score functions
  - Deprecate or remove duplicate logic
  - Ensure alignment with new tiered architecture
- [ ] Ensure existing second-order tests pass:
  - Update test expectations if needed
  - Add tests for new computation paths

**Constraints**

- Maintain backward compatibility where possible
- Document any breaking changes

**Acceptance Criteria**

- [ ] Second-order module uses new functions
- [ ] Tests pass
- [ ] No duplicate computation logic

---

## Phase Transition Checklist (Stability Iteration 4)

### ✅ Phase 0 – Derived Computation
- [ ] Derived score types defined
- [ ] Meta axes computation working
- [ ] Alignment, balance, cognitive load computed

### ✅ Phase 1 – Error Handling
- [ ] Error types and retry logic implemented
- [ ] Fallback rules working
- [ ] Pipeline recovers from failures

### ✅ Phase 2 – Diagnostics
- [ ] Pipeline diagnostics complete
- [ ] Service includes diagnostics
- [ ] Observability logging added

### ✅ Phase 3 – Integration
- [ ] Fingerprint schema updated
- [ ] Derived scores in pipeline
- [ ] Second-order module consolidated

---

## Summary

**Stability Iteration 4 Objective**: Complete Tier 3 (Derived Scores) and error handling where:
- All derived scores computed locally (no API cost)
- Cross-modal alignment and balance scores provide deep insight
- Comprehensive fallback logic ensures analysis always returns something
- Pipeline diagnostics enable debugging and monitoring
- Error handling is graceful at every tier
- Foundation set for UI updates in Iteration 5
