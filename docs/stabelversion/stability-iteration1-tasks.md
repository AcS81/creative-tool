# CreatorSight – Stability Iteration 1: Structure Pass (Tier 0)

## Document Information
- **Product**: CreatorSight
- **Iteration**: Stability 1 – Structure Pass ("Video Skeleton Extraction")
- **Version**: 1.0
- **Status**: Ready for Implementation
- **Target Outcome**: A reliable structure pass that:
  - Extracts video skeleton (chapters, key moments, content type) before any metrics
  - Provides context for all subsequent analysis tiers
  - Completes in seconds, not minutes
  - Never fails completely—graceful fallbacks for all edge cases

> Stability Iteration 1 = "understand the video shape before measuring anything"

---

## High-level Scope

From the stability refactor PRD, this iteration implements **Tier 0: Structure Pass**:

- New `structurePass.ts` for skeleton extraction
- `VideoSkeleton` type definitions and Zod validators
- Duration-based chapter/moment count rules
- Integration into the analysis service as the first step
- Fallback logic when structure extraction fails

Files to create:
- `src/lib/analysis/structurePass.ts`
- `src/lib/analysis/types/skeleton.ts`
- `src/lib/analysis/validators/skeleton.ts`

Files to modify:
- `src/lib/analysis/service.ts`
- `src/lib/analysis/jobs.ts`

---

## Phase 0: Type Definitions & Schema

### Task 0.1: Define VideoSkeleton Types

**Context**

- Stability Refactor Part 3.2: Tier 0 schema definition
- This is the foundational data shape for all subsequent analysis

**Goals**

- [x] Create `src/lib/analysis/types/skeleton.ts` with:
  - `VideoSkeleton` interface containing:
    - `durationSeconds: number`
    - `videoType: 'tutorial' | 'essay' | 'vlog' | 'reaction' | 'interview' | 'documentary' | 'entertainment' | 'other'`
    - `topicSummary: string` (2-3 sentences)
    - `chapters: Chapter[]` with id, title, start/end seconds, summary, chapterType
    - `keyMoments: KeyMoment[]` with type, timestamp, chapterId, description
    - `contentMix: ContentMix` with percentages for talking head, b-roll, graphics, screencast, other
    - `analysisHints: AnalysisHints` with hasMusic, hasSFX, hasOnScreenText, hasMultipleSpeakers, primaryLanguage, estimatedComplexity
- [x] Define supporting types:
  - `Chapter` with chapterType: 'intro' | 'hook' | 'body' | 'example' | 'tangent' | 'conclusion' | 'cta' | 'outro'
  - `KeyMoment` with type: 'hook' | 'peak' | 'twist' | 'payoff' | 'cta'
  - `ContentMix` with all percentage fields summing to ~100
  - `AnalysisHints` for downstream tier decisions
- [x] Export all types from `src/lib/analysis/types/index.ts`

**Constraints**

- All fields should have sensible defaults for fallback scenarios
- Types must be JSON-serializable for database storage
- Keep descriptions under 15 words as specified in the refactor doc

**Acceptance Criteria**

- [x] TypeScript compiles without errors
- [x] Types are importable from `src/lib/analysis/types`
- [x] Types match the schema in stability refactor Part 3.2

---

### Task 0.2: Create Zod Validators for Skeleton

**Context**

- Stability Refactor Part 3.2: Schema validation
- Must validate Gemini responses before use

**Goals**

- [x] Create `src/lib/analysis/validators/skeleton.ts` with:
  - `videoSkeletonSchema` Zod schema matching `VideoSkeleton` type
  - `chapterSchema` for individual chapter validation
  - `keyMomentSchema` for moment validation
  - `validateVideoSkeleton(data: unknown): VideoSkeleton` function
  - `safeValidateVideoSkeleton(data: unknown): { success: boolean, data?: VideoSkeleton, error?: string }`
- [x] Add validation rules:
  - chapters array: min 2, max 10
  - keyMoments array: min 1, max 7
  - contentMix percentages: 0-100, sum validation
  - timestamps: non-negative, endSeconds > startSeconds

**Constraints**

- Validation should be strict but provide clear error messages
- Support partial validation for fallback scenarios

**Acceptance Criteria**

- [x] Valid skeleton objects pass validation
- [x] Invalid objects fail with descriptive error messages
- [x] Edge cases handled: empty arrays, missing fields, out-of-range values
- [x] Unit tests cover success and failure paths

---

## Phase 1: Structure Pass Implementation

### Task 1.1: Create Structure Pass Function

**Context**

- Stability Refactor Part 3.2: Tier 0 implementation
- This is the first Gemini call in the new architecture

**Goals**

- [x] Create `src/lib/analysis/structurePass.ts` with:
  - `extractVideoSkeleton(input: StructurePassInput): Promise<VideoSkeleton>`
  - Input type: `{ youtubeUrl: string, durationSeconds?: number, youtubeChapters?: string[] }`
  - Uses Gemini client with minimal, focused prompt
  - Returns validated `VideoSkeleton`
- [x] Implement the prompt from refactor doc Part 3.2:
  - Asks for JSON only
  - Specifies exact output shape
  - Includes rules for chapter count based on duration
  - Uses YouTube chapters if provided
- [x] Add duration-based behavior:
  - < 3 min: 3-4 chapters, 2-3 key moments
  - 3-10 min: 4-5 chapters, 3-4 key moments
  - 10-20 min: 5-6 chapters, 4-5 key moments
  - > 20 min: 6-7 chapters, 5 key moments

**Constraints**

- Single Gemini call, ~$0.01-0.02 target cost
- Output ~500 tokens maximum
- Must complete in < 30 seconds for any video length

**Acceptance Criteria**

- [x] Structure pass returns valid skeleton for sample videos
- [x] Chapter count follows duration rules
- [x] Key moments are sparse and meaningful
- [x] Unit tests with mocked Gemini responses
- [ ] Integration test with real Gemini (required, requires API key)

---

### Task 1.2: Add Fallback Logic for Structure Pass

**Context**

- Stability Refactor Part 7: Error Handling & Fallbacks
- Structure pass failure should not block analysis

**Goals**

- [x] Implement `buildFallbackSkeleton(input: FallbackInput): VideoSkeleton`:
  - Creates duration-based default chapters
  - Marks all keyMoments as empty or placeholder
  - Sets videoType to 'other'
  - Sets estimatedComplexity to 'medium'
  - All analysisHints default to false/unknown
- [x] Update `extractVideoSkeleton` to use fallback on:
  - Gemini API error
  - Validation failure
  - Timeout (> 30 seconds)
- [x] Add `StructurePassResult` type:
  - `{ skeleton: VideoSkeleton, source: 'gemini' | 'fallback', error?: string }`
- [ ] Add fallback metadata for downstream tiers:
  - `_fallbackMetadata: { usedFallback: true, reason: string, confidence: 'low' }`

**Constraints**

- Fallback must never throw
- Fallback skeleton must pass validation
- Log errors for observability

**Acceptance Criteria**

- [x] Fallback produces valid skeleton
- [x] Structure pass returns result even when Gemini fails
- [x] Error messages are logged but not surfaced to user
- [x] Unit tests cover all fallback scenarios

---

## Phase 2: Service Integration

### Task 2.1: Add Structure Stage to Analysis Jobs

**Context**

- Stability Refactor Part 4: Migration Plan Phase 1
- Structure pass becomes the first stage in the pipeline

**Goals**

- [x] Modify `src/lib/analysis/jobs.ts`:
  - Add `'structure'` to job stages enum
  - Structure stage runs before any metric extraction
  - Store skeleton in job state for downstream tiers
- [x] Add job state fields:
  - `skeleton?: VideoSkeleton`
  - `structureSource?: 'gemini' | 'fallback'`
  - `structureError?: string`
  - `structureDurationMs?: number`

**Constraints**

- Backward compatible: existing jobs without structure stage should still work
- Structure stage failure should not block job (use fallback)

**Acceptance Criteria**

- [x] Jobs include structure stage in progression
- [x] Skeleton is persisted in job state
- [x] UI can display structure pass status

---

### Task 2.2: Integrate Structure Pass into Service

**Context**

- Stability Refactor Part 3.1: New architecture flow
- Service orchestrates the 4-tier pipeline

**Goals**

- [x] Modify `src/lib/analysis/service.ts`:
  - Add `extractVideoSkeleton` as first step in `analyzeVideo`
  - Pass skeleton to subsequent analysis functions
  - Include skeleton in `AnalyzeVideoResult`
- [x] Update `AnalyzeVideoResult` type:
  - Add `skeleton: VideoSkeleton`
  - Add `diagnostics.structurePass: PassResult`
- [x] Ensure Gemini-powered analysis uses skeleton context

**Constraints**

- Mock mode should skip structure pass (use static mock skeleton)
- Structure pass should be configurable via env flag

**Acceptance Criteria**

- [x] `analyzeVideo` returns skeleton in result
- [x] Diagnostics include structure pass metrics
- [x] Analysis pipeline uses skeleton for context
- [x] Tests updated to expect skeleton in result

---

## Phase 3: Configuration & Testing

### Task 3.1: Add Configuration for Structure Pass

**Context**

- Stability Refactor Part 6: Configuration & Feature Flags

**Goals**

- [x] Add environment variables:
  - `ENABLE_STRUCTURE_PASS=true` (default true)
  - `STRUCTURE_PASS_TIMEOUT_MS=30000` (default 30 seconds)
- [x] Update `src/lib/config.ts`:
  - Add `structurePassEnabled: boolean`
  - Add `structurePassTimeoutMs: number`
- [x] Add runtime check: skip structure pass if disabled, use mock skeleton

**Constraints**

- App must still work with structure pass disabled
- Configuration should be runtime, not build-time

**Acceptance Criteria**

- [x] Config flags control structure pass behavior
- [x] Documentation updated with new env vars
- [x] Tests cover enabled/disabled scenarios

---

### Task 3.2: Golden Set Validation for Structure Pass

**Context**

- Stability Refactor Part 9: Success Metrics
- Validate structure pass quality against known videos

**Goals**

- [x] Add structure pass tests to golden set:
  - Extract skeleton for golden set videos
  - Verify chapter count within expected range
  - Verify videoType classification accuracy
  - Verify keyMoments identify hook and conclusion
- [x] Create `scripts/test-structure-pass.ts`:
  - Runs structure pass on sample videos
  - Reports accuracy metrics
  - Flags regressions

**Constraints**

- Golden set tests should run in CI with mocked Gemini
- Real Gemini tests are manual/optional

**Acceptance Criteria**

- [x] Golden set includes structure pass expectations
- [x] Test script reports pass/fail for each video
- [x] > 80% accuracy on videoType classification
- [x] > 90% of videos get valid chapter structure

---

## Phase Transition Checklist (Stability Iteration 1)

### ✅ Phase 0 – Type Definitions
- [x] `VideoSkeleton` and related types defined
- [x] Zod validators created and tested

### ✅ Phase 1 – Structure Pass
- [x] `extractVideoSkeleton` implemented
- [x] Fallback logic handles all failure cases
- [x] Duration-based rules working

### ✅ Phase 2 – Service Integration
- [x] Jobs include structure stage
- [x] Service returns skeleton in result
- [x] Pipeline uses skeleton context

### ✅ Phase 3 – Configuration & Testing
- [x] Feature flags working
- [x] Golden set validation passing
- [ ] Real Gemini integration test run on sample videos

---

## Summary

**Stability Iteration 1 Objective**: Implement Tier 0 (Structure Pass) where:
- Every video gets a skeleton extracted before metrics
- Skeleton provides context (chapters, type, key moments) for downstream analysis
- Fast completion (~$0.01, < 30 seconds)
- Graceful fallbacks ensure analysis never fails at this stage
- Foundation is set for per-chapter core metrics in Iteration 2
