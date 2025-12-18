# CreatorSight – Iteration 6 Implementation Tasks (Alignment & Cognitive Load Foundations)

## Document Information
- **Product**: CreatorSight  
- **Upgrade Track**: Multimodal Alignment, Arc Quality, Cognitive Load  
- **Iteration**: 6 – Foundations (schema, mocks, UI scaffolding)  
- **Version**: 1.0  
- **Status**: Draft – Ready once Iteration 5 is green  
- **Target Outcome**: Add new alignment/arc/load signals to the fingerprint schema, mock pipeline, and UI so later iterations can ship real multimodal measurements without breaking the app.

> Scope: Translate the new metric wishlist (silence-for-emphasis fidelity, arc/beat quality, prosody vs meaning alignment, modality balance, cognitive load) into the product’s **schema, validators, seeds, and UI placeholders**. No real Gemini measurement yet—this iteration prepares the rails and keeps mock mode and existing UX stable.

---

## High-level Outcomes for Iteration 6
- Fingerprint schema **v1.3.0** (or next) adds alignment/arc/load fields with upgrade shims for legacy records.
- Axis metadata and docs cover the new signals (alignment, drift/decay, balance, timing, cognitive load).
- Mock analysis + seeds emit deterministic values for all new fields; `/api/analyze` responses stay backward compatible.
- UI shows lightweight cards for Alignment/Arc/Cognitive Load and integrates the new signals into “Where you’re unusual.”

---

## Phase 0: Metric Definitions & Axis Metadata

### Task 0.1: Finalize Metric Set & Semantics
- [ ] Translate the TODO list into concrete metrics with units + interpretations:  
  - Voice/Prosody: speaking pace (mean/variance/within-segment change), prosodic emphasis vs key phrases, energy drift.  
  - Language: analogy vs example vs definition ratio, sentence compression/complexity, humor signals (setup/punch timing), reference density, question rate (rhetorical vs genuine).  
  - Narrative/Arc: time-to-hook + hook strength proxy, segment cohesion/drift, open loops unresolved, ending strength/resolution completeness.  
  - Visual/Editing: visual entropy (change rate), cut rate refinements, silence-for-emphasis fidelity.  
  - Cross-modal/Second-order: audio-visual emphasis alignment, narrative beats vs edit changes alignment, prosody vs semantic importance alignment, redundancy/complementarity across modes, modality over-reliance, cognitive load per second, alignment/drift/decay/balance/timing scores.
- [ ] Decide which are **per-axis scores** vs **diagnostic arrays** (e.g., per-beat alignment timeline).
- [ ] Add concise one-liners for each metric to feed tooltips and prompts.

### Task 0.2: Axis Metadata & Docs
- [ ] Extend axis metadata map with IDs/labels/tooltips for all new metrics and second-order properties.
- [ ] Update `docs/axes_and_domains.md` with a short glossary section for Alignment/Load, including how to read “alignment”, “drift”, “decay”, “balance”, and “timing”.
- [ ] Add a small `docs/alignment_glossary.md` (or section) showing examples of “redundant vs complementary vs conflicting” multimodal moments.

---

## Phase 1: Fingerprint Schema & Validation Upgrade

### Task 1.1: Schema & Types
- [ ] Bump `VideoFingerprintJson` to **v1.3.0** (or next available) with new sections:  
  - `prosodyArc`: pace variance, energy drift, emphasis alignment to key phrases.  
  - `languageTexture`: analogy/example/definition ratio, compression, question mix, humor timing.  
  - `narrativeArc`: time_to_hook, hook_strength, cohesion_drift, open_loops_unresolved, ending_resolution.  
  - `visual_edit_alignment`: visual_entropy, cut_rate, silence_for_emphasis fidelity, audio_visual_emphasis_alignment, beats_vs_edits_alignment.  
  - `modality_balance`: redundancy_vs_complementarity, modality_over_reliance.  
  - `cognitive_load`: load_per_second (bucketed), highlights.  
  - `second_order`: alignment, drift, decay, balance, timing summary scores.  
- [ ] Add upgrade shim to rewrite older fingerprints to v1.3.0 with sensible defaults (e.g., `observed=false`, `score=0`).

### Task 1.2: Validators & Tests
- [ ] Update Zod schemas + TypeScript types; ensure strict alignment with the new fields.
- [ ] Add unit tests covering:  
  - Valid sample with all new fields.  
  - Missing alignment block → clear error.  
  - Legacy fingerprint upgrade path to v1.3.0.
- [ ] Keep `version` enforcement and ensure `fingerprint.version === '1.3.0'` on new writes.

---

## Phase 2: Mock Pipeline, Seeds, and API Compatibility

### Task 2.1: Mock Analysis Expansion
- [ ] Extend the mock generator to emit deterministic values for all new metrics (no randomness; keyed off videoId).
- [ ] Ensure diagnostics flag when new fields are defaulted vs “observed”.
- [ ] Add simple heuristics for second-order scores (alignment/drift/decay/balance/timing) derived from the mock values.

### Task 2.2: Seed Data Refresh
- [ ] Refresh `npm run seed` reference fingerprints to include the new fields (keep names/idempotency).
- [ ] Validate seeded fingerprints against the new schema; adjust similarity calculations to ignore alignment fields for now (or weight them minimally).

### Task 2.3: API/Insights Surfacing
- [ ] Keep `/api/analyze` response shape stable; add new fields under `fingerprint` without breaking existing clients.  
- [ ] Update “Where you’re unusual” heuristics to optionally cite new alignment/load signals (e.g., “High cognitive load spikes during payoff”).  
- [ ] Add regression tests for `/api/analyze` mock mode covering the new fields.

---

## Phase 3: UI Scaffolding & Documentation

### Task 3.1: Alignment & Load UI Cards
- [ ] Add an “Alignment & Load” section on Overview with simple badges/text for: audio-visual emphasis alignment, beats vs edits alignment, modality over-reliance, cognitive load trend.  
- [ ] Add minimal charts/placeholders (e.g., sparkline for load, bar list for alignment scores) that gracefully hide when data is missing.
- [ ] Update domain tabs to show relevant new metrics (e.g., prosody arc in Voice, analogy/definition ratio in Language, hook timing in Narrative).

### Task 3.2: Docs & E2E Notes
- [ ] Update `README` and `docs/iteration_6_e2e.md` (new) with the expected UI elements and how to verify mock values.  
- [ ] Add screenshots or short notes if any new UI affordances are non-obvious.

---

## Done When
- New metrics are defined, validated, and documented with tooltips and glossary.  
- Fingerprint schema v1.3.0 (or latest) is live with upgrade shims and passing tests.  
- Mock mode and seeds produce deterministic alignment/load signals; `/api/analyze` exposes them.  
- UI shows alignment/load placeholders without breaking existing flows; E2E doc updated.  
- Ready to start Iteration 7 (real multimodal measurement of the new metrics).

---

## Out of Scope (punted to Iteration 7+)
- Real Gemini measurement of alignment/load signals (multimodal prompt + parsing).  
- Advanced timeline visualizations (per-beat alignment heatmap).  
- Coaching copy tuned to the new metrics.  
- Performance-mode overlays for cognitive load vs retention.

