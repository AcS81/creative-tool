# CreatorSight – Iteration 9 Implementation Tasks (Signal Coverage & Arc Fidelity)

## Document Information
- **Product**: CreatorSight  
- **Iteration**: 9 – Signal Coverage, Arc Fidelity, and Silence Robustness  
- **Version**: 1.0  
- **Status**: Draft – starts after Iteration 8 UI uplift  
- **Target Outcome**: Close the gaps from `todo.md` by improving measurement quality (silence, arc, audience address), filling missing metrics, and recalibrating second-order scores so downstream UI can rely on real data.

> Scope: Strengthen the underlying signals so every factor called out in `todo.md` is measured (or explicitly marked unobserved) with useful diagnostics, ready for UI surfacing in Iteration 10.

---

## High-level Outcomes
- Silence-for-emphasis fidelity uses relative energy + flow gaps (not just raw quiet) and returns spans with placement/duration/beat alignment that work even with crowd/room noise.
- Arc/act understanding improves: reliable hooks/setups/escalations/payoffs, open-loop tracking, and time-to-hook strength are populated in Gemini mode and mocks.
- Coverage for “audience address frequency” and language texture ratios (analogy/example/definition, sentence compression, humor timing, question mix, reference density) is complete and validated.
- Pace/energy drift and visual entropy/cut pace are accurate enough to feed second-order Alignment/Drift/Decay/Timing without defaulting.
- Diagnostics state which advanced metrics were observed vs defaulted; golden tests guard regressions.

---

## Phase 0: Gap Audit & Acceptance
- [x] Map each `todo.md` factor to schema fields (or new ones) with acceptance criteria; add to `docs/iteration_9_gap_matrix.md`.
- [x] Define measurement correctness thresholds (e.g., silence gap detection must find >80% of known pauses in a test clip).
- [x] Confirm rollback flag behaviour (`ENABLE_ADVANCED_METRICS`) still works with new metrics.

---

## Phase 1: Metric Additions & Improvements

### Task 1.1: Silence-for-Emphasis Fidelity Upgrade
- [x] Implement relative-energy + speech-activity gap detection that tolerates crowd/bed noise; require min duration + drop vs local floor.
- [x] Annotate spans with placement intent (reset, punch, transition) and beat/punchline alignment; include duration and strength.
- [x] Tests: clips with ambient noise, commentator “shush” moments, and quiet B-roll; expect spans to register.

### Task 1.2: Arc/Act Understanding
- [x] Improve beat detection to classify hook/setup/escalation/payoff/outro with cohesion scores and “drift” diagnostics per segment.
- [x] Track open-loop creation/closure and ending resolution strength; populate `openLoopsUnresolvedRatio` and `endingResolutionScore` items.
- [x] Calibrate `timeToHookSeconds` and `hookStrengthScore` against a small labeled set; add fixtures.

### Task 1.3: Audience Address Frequency
- [x] Add `audience_address_frequency` (you/we addressing) as a language/voice metric with counts per minute + rhetorical vs direct.
- [x] Wire through prompt, validator, schema/types, mocks, and defaults; ensure axis metadata + glossary entries exist.

### Task 1.4: Language Texture Completeness
- [x] Ensure analogy/example/definition ratio, sentence compression, humor timing, question rate, and reference density all carry counts/timelines/items.
- [x] Add tests for partial/missing data; enforce non-empty diagnostics when observed.

### Task 1.5: Pace/Energy/Visual Dynamics
- [x] Tighten speaking pace mean/variance and within-segment drift timelines; validate WPM ranges and % swings.
- [x] Improve energy drift slope (dB/min) smoothing to avoid false negatives; keep timelines populated.
- [x] Upgrade visual entropy and cut-rate refinement (median/variance/beat coupling) to reduce “unobserved” on noisy videos.

### Task 1.6: Second-order Rebalance
- [x] Recompute Alignment/Drift/Decay/Balance/Timing formulas with the upgraded metrics; document weighting and any clamping.
- [x] Add sanity tests (high alignment clip vs drifty clip) to confirm score spread.

---

## Phase 2: Pipeline Integration & Fallbacks
- [x] Update Gemini prompt snippets to describe the new/changed metrics (silence gaps, audience address, arc labeling); enforce JSON array population where required.
- [x] Extend parsers/validators to capture new fields and stricter timelines/spans; provide clear errors for missing blocks.
- [x] Ensure `mapAdvancedMetrics` respects observed flags and keeps defaults only when data is absent; add diagnostics flags per metric group.
- [x] Keep mock mode deterministic with upgraded mock generators for new fields and richer spans.

---

## Phase 3: Quality, Golden Set, and Regression
- [x] Add golden clips: (a) sports highlight with crowd shush, (b) essay with long pauses, (c) high-cut vlog, (d) Q&A heavy talk for audience-address.
- [x] Extend `npm run eval:golden` (or similar) to assert: silence spans count >0 where expected, audience address > threshold, hook < target time, entropy timeline populated.
- [x] Unit tests for parser/validator covering partial missing advanced metrics and “unobserved” paths.
- [ ] Benchmarks: measure latency/cost impact of the richer prompt; document acceptable ceilings.

---

## Phase 4: Documentation & Glossary
- [ ] Update `docs/axes_and_domains.md` and `docs/iteration_6_metric_semantics.md` with new/changed metrics (audience address, silence rules, arc labeling).
- [ ] Add `docs/iteration_9_e2e.md` checklist: run Gemini mode, verify silence spans, audience-address metric, arc beats, and second-order scores are populated; confirm diagnostics callouts.
- [ ] Note default/fallback behaviour and how to interpret “unobserved” for the new metrics.

---

## Done When
- All `todo.md` factors exist as measured metrics (or explicit unobserved) with diagnostics, including silence robustness and audience address frequency.
- Advanced metrics timelines/spans are populated in Gemini mode and mocks; second-order scores reflect the improved inputs.
- Golden run catches regressions; docs describe the semantics and how to verify them.
