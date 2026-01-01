# CreatorSight – Iteration 7 Implementation Tasks (Real Alignment & Load Measurement)

## Document Information
- **Product**: CreatorSight  
- **Iteration**: 7 – Real Alignment/Arc/Cognitive Load Measurement (Gemini)  
- **Version**: 1.0  
- **Status**: Draft – Ready after Iteration 6 completion  
- **Target Outcome**: Replace mock-only alignment/arc/load signals with real multimodal Gemini measurements, keep schema v1.3.0 stable, and harden quality with diagnostics + regression checks.

> Scope: Turn the Iteration 6 scaffolding (schema v1.3.0, mock alignment/load metrics, UI cards) into a production-quality multimodal path that measures these signals for real YouTube inputs, with safe defaults and regression coverage.

---

## High-level Outcomes
- `/api/analyze` in `ANALYSIS_MODE=gemini` returns **observed** alignment/arc/load metrics (not defaulted) under `fingerprint` v1.3.0, with clear diagnostics when anything is unobserved.
- Gemini prompt + parser cover the v1.3.0 advanced metrics (prosodyArc, languageTexture, narrativeArc, visualEditAlignment, modalityBalance, cognitiveLoad, secondOrder).
- Insights, similarity, and UI surfaces use the real metrics (or graceful fallbacks) without regressions to existing meta axes or performance overlay.
- Golden/regression checks confirm quality on a small YouTube set; mock mode remains deterministic for local dev.

---

## Phase 0: Flags, Config, and Safety Nets

### Task 0.1: Mode/Flag Wiring
- Make real alignment/load measurement **default** when `ANALYSIS_MODE=gemini`; keep mock behaviour unchanged.
- Add a guarded rollback flag (e.g., `ENABLE_ADVANCED_METRICS=false`) that forces defaults + diagnostics but does not break schema.
- Diagnostics: expose `diagnostics.advancedMetricsObserved`, `advancedMetricsDefaulted`, and a short reason when defaults were applied.

### Task 0.2: Prompt Safety & Cost Guards
- Keep temperature low; ensure single multimodal call still <2–3 min typical.
- Treat URL ingestion failures as explicit errors (no download/upload fallback); surface a “lower confidence” indicator only when metrics are unobserved/defaulted.

---

## Phase 1: Gemini Prompt, Parser, and Validator (Advanced Metrics)

### Task 1.1: Prompt & JSON Schema
- Update multimodal prompt to request all v1.3.0 advanced fields with concise metric definitions (mirror `docs/iteration_6_metric_semantics.md`).
- Require timelines/spans/items where applicable (pace timeline, load timeline, silence spans, alignment offsets, jokes setup/punch deltas).
- Enforce `responseMimeType: application/json` and keep unobserved handling (`value: "unobserved", score: 0`).

### Task 1.2: Parser & Validation
- Extend `parseGeminiMultimodalJson` (and zod validators) to map every advanced metric into `VideoFingerprintJson` v1.3.0.
- Harden error messages for partial/missing blocks; if advanced metrics missing, fill from defaults and set diagnostics.
- Tests: mocked Gemini responses covering full success, partial missing advanced section, and “unobserved” paths.

---

## Phase 2: Pipeline Integration & Persistence

### Task 2.1: Analyzer Wiring
- Update `analyzeVideoMultimodal` to populate advanced metrics when Gemini returns them; default only when absent.
- Ensure upgrade shim still works for legacy fingerprints, but new analyses always emit observed advanced metrics when possible.

### Task 2.2: Seeds & Reference Refresh
- Option A: leave seeds as mock-generated (fast, deterministic).  
- Option B (preferred if time): refresh seed fingerprints with a one-time Gemini run for alignment/load metrics, storing observed values while keeping schema v1.3.0.
- Document which option was chosen in the seed README note.

---

## Phase 3: Insights, Similarity, and UI Refinement

### Task 3.1: Insights
- Update “Where you’re unusual” heuristics to optionally cite alignment/load (e.g., “Audio/visual emphasis unusually tight” or “High cognitive-load spikes near payoff”).
- Add guardrails so insights never reference missing/placeholder values.

### Task 3.2: UI Surfaces
- Keep the Overview “Alignment & Load” panel; feed it real data + timelines.  
- Add a minimal tooltip or detail popover showing top alignment diagnostics (e.g., worst alignment offset, dominant modality).  
- Domain tabs: add small callouts for key advanced metrics (Voice: pace variance; Narrative: time-to-hook; Visual/Edit: silence fidelity; Sound: alignment notes).

### Task 3.3: Similarity Weighting (Optional)
- Evaluate whether to include second-order scores (alignment/balance/timing) in neighbour distance; if included, keep weight low and document the change.

---

## Phase 4: Regression & E2E

### Task 4.1: Golden Set
- Extend `docs/multimodal_golden_set.md` with 3–5 examples that exercise alignment/load (e.g., high-edit vlog, slow essay, joke-heavy story).  
- Add a script (or extend `npm run eval:golden`) to log the advanced metrics and flag missing/unobserved fields.

### Task 4.2: E2E Doc
- Add `docs/iteration_7_e2e.md` with a short checklist: run analysis in Gemini mode, confirm Alignment & Load populated, insights mention alignment/load, diagnostics show `advancedMetricsObserved=true`.

---

## Done When
- `/api/analyze` (Gemini mode) returns v1.3.0 fingerprints with real alignment/load metrics and clear diagnostics for any defaults.
- Prompt/parser/tests cover the advanced fields; mock mode remains deterministic.
- UI and insights surface the new signals without regressions; golden-set script runs and highlights missing data if any.
- Rollback flag exists; default path is “real metrics on, mock only in mock mode.”
