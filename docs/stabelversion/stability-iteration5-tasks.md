# CreatorSight – Stability Iteration 5: UI Updates & Finalization

## Document Information
- **Product**: CreatorSight
- **Iteration**: Stability 5 – UI Updates & Finalization ("Progressive Loading & Polish")
- **Version**: 1.0
- **Status**: Ready for Implementation
- **Target Outcome**: A polished UI experience that:
  - Shows progressive loading as each tier completes
  - Handles observed/unobserved metric states gracefully
  - Displays structure (chapters, key moments) prominently
  - Defers archetype comparison features for future work
  - Achieves all stability success metrics

> Stability Iteration 5 = "show what we have, acknowledge what we don't"

---

## High-level Scope

From the stability refactor PRD, this iteration implements **UI Changes** and **Cleanup**:

- Progressive loading UI as tiers complete
- Observed/unobserved state display for all metrics
- Structure visualization (chapters, video type)
- Deferred feature cleanup (archetypes, library comparison)
- Documentation and testing finalization

Files to modify:
- `src/components/` (various UI components)
- `src/app/page.tsx` and related pages
- `docs/axes_and_domains.md`
- Test files for E2E validation

---

## Phase 0: Progressive Loading UI

### Task 0.1: Add Analysis Progress Component

**Context**

- Stability Refactor Part 8: Progressive Loading
- Users should see results as they become available

**Goals**

- [ ] Create `src/components/AnalysisProgress.tsx`:
  - Display current analysis stage: structure → core → advanced → derived
  - Show stage completion status (pending, running, complete, failed)
  - Display time elapsed and estimated remaining
  - Show skeleton summary immediately when structure completes
- [ ] Implement progress states:
  - "Analyzing video structure..." (skeleton pass)
  - "Measuring core metrics..." (core pass per chapter)
  - "Analyzing key moments..." (advanced pass, optional)
  - "Computing insights..." (derived scores)
  - "Complete" with final status

**Constraints**

- Progress should update in real-time (polling or SSE)
- Failed stages should show graceful error state
- Component should be reusable

**Acceptance Criteria**

- [ ] Progress shows all stages
- [ ] Updates as analysis progresses
- [ ] Handles failures gracefully
- [ ] Visually appealing animation/transitions

---

### Task 0.2: Implement Streaming Results Display

**Context**

- Show partial results as they complete

**Goals**

- [ ] Modify main analysis page to:
  - Show skeleton summary (chapters, video type) immediately after structure pass
  - Show radar chart and domain scores after core pass
  - Show detailed insights after advanced pass
  - Show derived scores and coaching after completion
- [ ] Add incremental reveal:
  - Skeleton section appears first
  - Domain sections fade in as core completes
  - Advanced detail sections appear when available

**Constraints**

- Page should not flicker or jump during updates
- Skeleton must be shown before full analysis

**Acceptance Criteria**

- [ ] Partial results displayed progressively
- [ ] No jarring layout changes
- [ ] Time to first result < 15 seconds (structure pass)

---

### Task 0.3: Add Chapter/Key Moments Visualization

**Context**

- Structure pass provides valuable context to display

**Goals**

- [ ] Create `src/components/VideoStructure.tsx`:
  - Display chapters as a horizontal timeline
  - Show chapter types with visual indicators
  - Highlight key moments (hook, peak, twist, payoff, cta)
  - Show content mix breakdown (talking head, b-roll, etc.)
- [ ] Integrate into Overview:
  - Show video type prominently
  - Display chapter timeline below video info
  - Make chapters clickable (future: jump to timestamp)

**Constraints**

- Timeline should be responsive
- Handle videos with few or many chapters

**Acceptance Criteria**

- [ ] Chapters displayed clearly
- [ ] Key moments highlighted
- [ ] Content mix visualized
- [ ] Responsive on all screen sizes

---

## Phase 1: Observed/Unobserved State Handling

### Task 1.1: Create Observed State Components

**Context**

- Stability Refactor Part 8: Observed/Unobserved states

**Goals**

- [ ] Create `src/components/MetricValue.tsx`:
  - Display metric score and value when observed
  - Display "Not measured" chip when unobserved
  - Show reason tooltip for unobserved metrics
  - Support partial observation (show available data)
- [ ] Create visual indicators:
  - `ObservedBadge`: green checkmark for observed
  - `UnobservedChip`: gray "Not measured" with tooltip
  - `PartialBadge`: yellow indicator for partial data

**Constraints**

- Unobserved state should not break layout
- Tooltips should explain why metric wasn't measured

**Acceptance Criteria**

- [ ] Observed metrics display normally
- [ ] Unobserved metrics show clear indicator
- [ ] Tooltips provide useful context

---

### Task 1.2: Update Domain Tabs for Observed States

**Context**

- All metric displays need observed/unobserved handling

**Goals**

- [ ] Update all domain tab components:
  - Voice, Language, Narrative, Visual, Editing, Sound
  - Use `MetricValue` for all metrics
  - Show domain-level coverage percentage
  - Handle all-unobserved domain gracefully
- [ ] Add coverage indicators:
  - "85% of voice metrics measured"
  - Visual progress bar for coverage
  - Explain what would improve coverage

**Constraints**

- Existing styling should be preserved
- Domain with no observed metrics should still render

**Acceptance Criteria**

- [ ] All domains handle unobserved states
- [ ] Coverage shown per domain
- [ ] No crashes on missing data

---

### Task 1.3: Update Radar Chart for Partial Data

**Context**

- Radar chart must handle unobserved axes

**Goals**

- [ ] Modify radar chart component:
  - Show observed axes normally
  - Show unobserved axes with different styling (dashed, gray)
  - Add legend explaining observed vs unobserved
  - Tooltip shows observation status
- [ ] Handle edge cases:
  - All axes observed: normal display
  - Some axes unobserved: mixed display
  - All axes unobserved: show placeholder message

**Constraints**

- Chart should remain readable with partial data
- Visual distinction must be clear

**Acceptance Criteria**

- [ ] Partial data displays correctly
- [ ] Legend explains status
- [ ] Edge cases handled

---

## Phase 2: Feature Deferral & Cleanup

### Task 2.1: Defer Archetype Features

**Context**

- Stability Refactor Part 8: Deferred features

**Goals**

- [ ] Identify archetype-related code:
  - Archetype classification display
  - "Who you're most like" section
  - Per-domain archetype comparisons
- [ ] Hide or remove deferred features:
  - Keep data structures in schema (for future)
  - Remove from UI display
  - Add config flag `SHOW_ARCHETYPE_FEATURES=false`
- [ ] Add "Coming soon" placeholders where appropriate

**Constraints**

- Don't delete archetype code, just hide from UI
- Schema should remain compatible
- Flag should allow re-enabling later

**Acceptance Criteria**

- [ ] Archetype features hidden by default
- [ ] Code still present but not executing
- [ ] Can re-enable via config

---

### Task 2.2: Defer Reference Library Comparison

**Context**

- Reference library is lower priority during stability work

**Goals**

- [ ] Identify reference library UI:
  - "Nearest creators" section
  - Reference similarity scores
  - Library browsing
- [ ] Hide reference features:
  - Remove from Overview
  - Add config flag `SHOW_REFERENCE_LIBRARY=false`
  - Keep underlying similarity code
- [ ] Simplify Overview:
  - Focus on user's own metrics
  - Show coaching based on own data, not comparisons

**Constraints**

- Similarity computation can remain
- Just hide from UI

**Acceptance Criteria**

- [ ] Reference features hidden
- [ ] Overview cleaner
- [ ] Can re-enable later

---

### Task 2.3: Code Cleanup

**Context**

- Remove dead code and consolidate

**Goals**

- [ ] Identify deprecated code:
  - Old all-at-once analysis paths
  - Unused mock data
  - Deprecated type definitions
- [ ] Add deprecation warnings:
  - Mark old functions as `@deprecated`
  - Log warnings when deprecated code runs
  - Plan removal for next major version
- [ ] Update imports:
  - Ensure new tiered paths are used
  - Remove circular dependencies

**Constraints**

- Don't break anything that's still needed
- Document what was deprecated and why

**Acceptance Criteria**

- [ ] Deprecated code marked
- [ ] No broken imports
- [ ] Codebase cleaner

---

## Phase 3: Documentation & Testing

### Task 3.1: Update Architecture Documentation

**Context**

- Documentation should reflect new 4-tier architecture

**Goals**

- [ ] Update `docs/axes_and_domains.md`:
  - Reflect tier structure
  - Update metric lists by tier
  - Add tier descriptions
- [ ] Create `docs/stability-architecture.md`:
  - Document 4-tier flow
  - Explain fallback behavior
  - Include diagrams
- [ ] Update README:
  - Explain new analysis approach
  - Update configuration section
  - Add troubleshooting for common issues

**Acceptance Criteria**

- [ ] Documentation accurate
- [ ] Tier structure clear
- [ ] README updated

---

### Task 3.2: E2E Testing for Stability

**Context**

- Stability Refactor Part 9: Success metrics validation

**Goals**

- [ ] Create `docs/stability_e2e.md`:
  - E2E flow for tiered analysis
  - Verification steps for each tier
  - Expected behavior for failures
- [ ] Add automated E2E tests:
  - Test happy path through all tiers
  - Test structure pass failure → fallback
  - Test core chapter failure → partial results
  - Test advanced skip → complete without advanced
- [ ] Verify success metrics:
  - Completion rate by video length
  - Time to first result
  - Cost per video

**Constraints**

- E2E tests should use mocked Gemini in CI
- Real API tests are manual

**Acceptance Criteria**

- [ ] E2E documentation complete
- [ ] Automated tests passing
- [ ] Success metrics verified

---

### Task 3.3: Final Quality Validation

**Context**

- Ensure stability targets are met

**Goals**

- [ ] Run full golden set validation:
  - All videos complete with tiered analysis
  - Coverage targets met (>90% Tier 1)
  - No regressions from baseline
- [ ] Performance validation:
  - < 5 min videos: >99% completion
  - 5-15 min videos: >95% completion
  - > 15 min videos: >85% completion
  - Time to first result < 15 seconds
  - Cost within targets ($0.10-0.30)
- [ ] Create stability report:
  - Document results
  - Note any remaining issues
  - Plan for future improvements

**Constraints**

- Must meet targets defined in refactor doc

**Acceptance Criteria**

- [ ] All targets met or documented exceptions
- [ ] Golden set passes
- [ ] Report created

---

## Phase Transition Checklist (Stability Iteration 5)

### ✅ Phase 0 – Progressive Loading
- [ ] Progress component created
- [ ] Streaming results working
- [ ] Structure visualization complete

### ✅ Phase 1 – Observed States
- [ ] Metric value component handles all states
- [ ] Domain tabs updated
- [ ] Radar chart handles partial data

### ✅ Phase 2 – Feature Deferral
- [ ] Archetype features hidden
- [ ] Reference library hidden
- [ ] Code cleanup complete

### ✅ Phase 3 – Documentation & Testing
- [ ] Architecture docs updated
- [ ] E2E tests passing
- [ ] Final quality validated

---

## Summary

**Stability Iteration 5 Objective**: Complete UI updates and finalize stability refactor where:
- Progressive loading shows results as tiers complete
- Observed/unobserved states displayed clearly throughout
- Structure (chapters, key moments) prominently displayed
- Deferred features hidden but preserved for future
- All stability success metrics validated
- Documentation and tests complete

---

## Final Stability Refactor Checklist

After completing all 5 iterations, verify:

### Architecture
- [ ] 4-tier analysis (Structure → Core → Advanced → Derived) working
- [ ] Each tier independent with proper fallbacks
- [ ] Pipeline completes for any video length

### Stability Targets
- [ ] >99% completion for < 5 min videos
- [ ] >95% completion for 5-15 min videos
- [ ] >85% completion for > 15 min videos
- [ ] Time to first result < 15 seconds
- [ ] Cost per video $0.10-0.30

### Quality Targets
- [ ] >90% Tier 1 metrics observed
- [ ] >75% Tier 2 metrics observed when requested
- [ ] >85% Tier 3 metrics computable
- [ ] Golden set accuracy maintained

### UX
- [ ] Progressive loading working
- [ ] Observed/unobserved states clear
- [ ] Structure visualization helpful
- [ ] Error states graceful
