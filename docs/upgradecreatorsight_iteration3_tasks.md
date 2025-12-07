# CreatorSight – Iteration 3 Implementation Tasks (Multimodal Launch & Integration)

## Document Information

- **Product**: CreatorSight  
- **Upgrade Track**: Native Multimodal Analysis  
- **Iteration**: 3 – “Launch it for real”  
- **Version**: 1.0  
- **Status**: Draft – Ready to Implement once Iteration 2 checklists are green  

> **Scope of this iteration**: Take the **multimodal analysis pipeline** and **UX improvements** delivered in Iterations 1–2 and make them the **canonical, production path**. This iteration:
> - Promotes the v2 multimodal pipeline from “experimental flag” to **default creative analysis path**.  
> - Re-aligns **fingerprints, similarity, and reference library** to the new metrics.  
> - Confirms **performance overlay** still behaves correctly with the new narrative/beat structure.  
> - Retires or minimizes the old text-only path, cleaning up code and docs so `docs/analysis_functionality_plan.md` reflects **how the system actually works**.

This iteration **completes the Native Multimodal Analysis Plan** by fully wiring the v2 pipeline into:

- The existing **PRD FR‑5–FR‑15** surfaces (creative domains, fingerprint, similarity, overview UI).  
- The optional **YouTube Analytics overlay** (FR‑12–FR‑13), ensuring it plays nicely with the new beats/timeline data.  

Out of scope:

- New UX concepts beyond what’s already planned/implemented (no new coaching model, no new domains).  
- Channel‑level aggregation or future roadmap features beyond the MVP PRD.  

---

## High-level Outcomes for Iteration 3

When this iteration is done:

- `/api/analyze` **always** uses the multimodal pipeline for creative analysis when `ANALYSIS_MODE = gemini`, with the old v1 text-only flow relegated to a guarded emergency fallback (or removed if you choose).  
- `VideoFingerprintJson` v2 is the **single canonical fingerprint schema**, used consistently in:
  - DB storage.  
  - Similarity engine and reference library.  
  - Overview + domain views, insights, and diagnostics.  
- The **reference library** has been refreshed using v2 fingerprints, and “Closest neighbours” / “Where you’re unusual” are grounded in the new meta axes.  
- Optional **Performance mode** (YouTube Analytics) still works and aligns retention timelines with the new multimodal beats.  
- Old, text-only Gemini analysis code and docs are either:
  - Removed, or  
  - Clearly marked as deprecated fallback paths.  

---

## Phase 0: Flip the Switch – Multimodal as the Default Path

### Task 0.1: Production-ready Flag Strategy (`ANALYSIS_MODE` + `ENABLE_ANALYSIS_V2_MULTIMODAL`)

**Context**

- Iteration 1 introduced a feature flag (e.g. `ENABLE_ANALYSIS_V2_MULTIMODAL`) to gate the multimodal path.  
- Iteration 2 added diagnostics (`diagnostics.source = 'gemini-v2-multimodal' | 'gemini-v1-text' | 'mock'`) and a golden-set script to validate behaviour.  
- Right now, the text-only path may still be the default in some environments.

**Goals**

- [ ] Define a clear **flag matrix** for analysis modes in `getAppConfig` / env handling:
  - [ ] `ANALYSIS_MODE = mock | gemini`.  
  - [ ] `ENABLE_ANALYSIS_V2_MULTIMODAL` becomes **true by default** in non-test environments where Gemini is configured.  
  - [ ] Optionally introduce a single `ANALYSIS_VERSION = v1 | v2` env for emergency rollback, mapped internally to the existing flags.  
- [ ] Update `src/lib/analysis/service.ts` (or equivalent `analyzeVideo`) to:
  - [ ] Prefer the **multimodal** path whenever `ANALYSIS_MODE = gemini` and the v2 flag is not explicitly disabled.  
  - [ ] Only route to the old text-only flow when:
    - A dedicated **rollback flag** is set, or  
    - Multimodal returns a hard error code explicitly marked as “unsupported in this environment”.  
- [ ] Ensure `/api/analyze` responses always include:
  - [ ] `diagnostics.source` (`'gemini-v2-multimodal' | 'gemini-v1-text' | 'mock'`).  
  - [ ] A simple `diagnostics.multimodalFallbackUsed` boolean when the temp-upload path is taken.

**Constraints**

- No breaking changes to the public `/api/analyze` contract; diagnostics additions must be additive.  
- Flags must behave predictably across local dev, CI, and any deployed environment.  

**Acceptance Criteria**

- [ ] With default env values in dev, `/api/analyze` uses `diagnostics.source = 'gemini-v2-multimodal'` for real runs.  
- [ ] Toggling a single env (e.g. `ANALYSIS_VERSION=v1`) forces the old path without code changes.  
- [ ] Tests or a small script cover the basic flag combinations (mock, v1 text, v2 multimodal) and assert `diagnostics.source`.  

---

### Task 0.2: Decide and Implement the v1 Decommissioning Strategy

**Context**

- The Native Multimodal Analysis Plan assumes **one multimodal call per job**, with the text-only path treated as legacy.  
- Keeping full v1 code around forever increases maintenance and confusion.  

**Goals**

- [ ] Make an explicit decision and document it in `docs/analysis_functionality_plan.md` (or a small `docs/multimodal_launch_notes.md`):  
  - [ ] Option A – **Soft deprecation**: keep v1 code for a limited time as a guarded fallback only.  
  - [ ] Option B – **Removal**: delete v1 text-only analysis code once v2 has been live-tested.  
  - ✅ Decision: Option B chosen — the text-only Gemini pipeline has been removed and `ANALYSIS_VERSION=v1` now errors.
- [ ] Implement the chosen path:
  - [ ] If soft-deprecating:
    - [ ] Gate v1 behind a clear “fallback only” branch with prominent comments and logs.  
    - [ ] Add a TODO with a date/version when v1 can be removed.  
  - [ ] If removing:
    - [ ] Delete v1-only modules (`geminiDomains.ts` text-only functions, redundant schemas) and associated dead tests.  
    - [ ] Update imports so all domain analysis flows through the v2 analyzer.  

**Constraints**

- Must not accidentally remove any code used by mock mode or non-Gemini paths.  
- Any removal must be accompanied by updated tests and green CI.  

**Acceptance Criteria**

- [ ] There is a one-paragraph note in docs clarifying whether v1 still exists and in what capacity.  
- [ ] No remaining callers reference the old multi-call text-only pipeline except the explicitly guarded fallback (if kept).  
- [ ] CI/test suite passes with v2 as the primary path.  

---

## Phase 1: Canonical Fingerprint & Reference Library Refresh

### Task 1.1: Make `VideoFingerprintJson` v2 the Single Canonical Schema

**Context**

- Iteration 1 introduced a v2 fingerprint builder for multimodal outputs.  
- Existing code and DB may still reference legacy v1 shapes or mix v1/v2 concepts.  
- The analysis plan expects one canonical `VideoFingerprintJson` used everywhere (FR‑14).  

**Goals**

- [ ] Consolidate fingerprint types in `src/lib/schemas/fingerprint.ts` (or equivalent) so that:
-  - ✅ `VideoFingerprintJson` v2 is clearly marked as the **canonical** schema; legacy v1.1 inputs are upgraded to v2 on validation.  
-  - ✅ Any v1 variants are supported only via a small, explicit migration helper in validation.  
- [ ] Ensure `buildVideoFingerprint` from Iteration 1:
-  - ✅ Is the only entry point used by `analyzeVideo` for creative fingerprints.  
-  - ✅ Produces all meta axes described in `docs/axes_and_domains.md`.  
- [ ] Update DB/Prisma types (if needed) so `VideoFingerprint` storage is aligned with v2:
-  - ✅ Version is fixed to `1.2.0` in types/schemas; legacy reads are upgraded in-memory.

**Constraints**

- Avoid big-bang DB migrations if possible; prefer additive changes or re-seeding reference fingerprints.  
- TypeScript types and Zod schemas must agree; no `any` casts around fingerprints.  

**Acceptance Criteria**

- [ ] Code search for old fingerprint shapes (e.g. v1-only fields) shows no active usage outside migration code.  
- [ ] All fingerprint-related tests (`fingerprint.test.ts`, `service.test.ts`, similarity tests) compile and pass against v2.  
- [ ] New fingerprints created via `/api/analyze` clearly identify schema version (explicit field or documented guarantee).  

---

### Task 1.2: Rebuild Reference Library with Multimodal Fingerprints

**Context**

- PRD FR‑15 and the analysis plan’s architecture step 4 call for “nearest references” based on a reference library.  
- As of Iteration 5 (pre-upgrade), reference fingerprints were built from the old text-only pipeline.  
- After switching to v2 metrics, the reference library should be regenerated so similarity comparisons remain meaningful.  

**Goals**

- [ ] Add a small dev script (or extend an existing one) to:
  - [ ] Iterate over all `CreatorProfile` records with `type = "reference"`.  
  - [ ] Re-run analysis via the **multimodal pipeline** for their canonical videos.  
  - [ ] Persist updated v2 fingerprints in the DB.  
-  - ✅ Added `scripts/refresh-reference-library.ts` (guarded by `ALLOW_REFERENCE_REFRESH=true`) to re-run multimodal analysis for all reference creators and upsert fingerprints.
- [ ] Update `prisma/seed.ts` (or seed data files) to:
  - ✅ Seed reference creators with v2 fingerprints by default.  
  - ✅ Ensure seeded fingerprints pass `validateFingerprint` and align with `axisMetadata`.  
- ✅ Verify and, if needed, recalibrate similarity helpers (`computeAverageMetaAxes`, `findNearestReferences`):
  - ✅ Confirmed they operate solely on v2 meta axes (no v1 fields).  

**Constraints**

- The regeneration script should be safe to run in dev/staging only (guard with env flag).  
- Don’t rely on long external runs in CI; keep reference re-analysis a manual or semi-automated step.  

**Acceptance Criteria**

- [ ] Running the regeneration script on dev/staging produces v2 fingerprints for all reference creators without runtime errors.  
- [ ] `similarity.test.ts` (or equivalent) passes using v2 fingerprints and expected distances.  
- [ ] “Closest neighbours” UI and “niche average” meta axes behave sensibly after the refresh.  

---

### Task 1.3: Align “Where You’re Unusual” and Insights with v2 Axes

**Context**

- Iteration 3 of the original CreatorSight track introduced insights and “Where you’re unusual”.  
- Iterations 1–2 of the upgrade track changed the underlying axes and semantics (see `docs/axes_and_domains.md`).  
- Insights logic may still be calibrated for v1 distributions.  

**Goals**

- [ ] Review `src/lib/analysis/insights.ts` (or equivalent) and update it to:
  - [ ] Use v2 meta axes and key domain metrics as inputs.  
  - [ ] Respect “unobserved” semantics from the multimodal plan (don’t treat 0 = bad when it means “unseen”).  
- [ ] Re-tune thresholds or percentiles used to determine unusualness so:
  - [ ] Insights remain sparse and high-signal (3–8 key insights per analysis).  
  - [ ] Extreme insights are reserved for genuinely unusual fingerprints.  
- [ ] Ensure Overview and domain insights UIs are reading from the updated insights object without additional v1 assumptions.  

**Constraints**

- No reliance on Analytics/performance metrics for these insights; they must be purely creative-fingerprint-driven.  
- Keep logic deterministic and rule-based; avoid any new LLM calls in the insights layer.  

**Acceptance Criteria**

- [ ] For a small set of sample analyses (including golden videos), insights read as coherent and grounded in the axes described in `docs/axes_and_domains.md`.  
- [ ] Tests (unit or snapshot) confirm that changing key metrics (e.g. `cut_rate`, `music_changes`, `concreteness`) affects which insights fire.  
- [ ] “Where you’re unusual” chips/cards on Overview clearly correspond to numeric deviations visible in the radar charts.  

---

## Phase 2: Performance Overlay & Narrative Timeline Harmony

### Task 2.1: Align Narrative Beats with Retention Timeline

**Context**

- The analysis plan’s architecture step 4 mentions an optional performance overlay aligned with beats.  
- Iteration 5 already implemented performance timelines and a Performance tab using v1 beats.  
- Multimodal narrative analysis now produces more structured `beats` (roles: hook, setup, escalation, payoff, outro).  

**Goals**

- [ ] Extend the multimodal narrative schema and fingerprint builder (if needed) so beats used by:
  - [ ] `DomainTimeline` (Narrative tab).  
  - [ ] Performance timeline overlay.  
  share a common structure and roles.  
- [ ] Update performance profile/timeline builders to:
  - [ ] Snap retention points (from YouTube Analytics) to the new beat structure (e.g. show drops during hook vs setup vs payoff).  
  - [ ] Avoid regressions when narrative beats are sparse or unobserved.  
- [ ] Ensure the Performance tab:
  - [ ] Clearly labels where major retention changes occur relative to narrative roles.  
  - [ ] Handles videos without Analytics gracefully (creative-only mode unchanged).  

**Constraints**

- Keep `VideoFingerprintJson` additions backward-compatible (new optional fields only).  
- Do not introduce additional external APIs beyond what Iteration 5 already uses.  

**Acceptance Criteria**

- [ ] For at least two videos with Analytics configured:
  - Narrative tab shows hook/setup/payoff beats from the multimodal response.  
  - Performance tab overlays retention curves with beat markers that line up sensibly in time.  
- [ ] Existing performance tests (`analytics.test.ts`, performance profile/timeline tests) still pass, with any necessary updates documented.  

---

### Task 2.2: Verify Performance-mode UX & Copy with Multimodal Data

**Context**

- Performance coaching copy was written against the text-only + basic-beat world.  
- Multimodal beats and soundscape metrics may provide richer context (e.g. clearer identification of drop-causing segments).  

**Goals**

- [ ] Audit Performance tab copy and micro-insights to ensure:
  - [ ] They remain accurate given the new beat semantics.  
  - [ ] They don’t contradict multimodal findings (e.g. claiming “no music” when Sound tab clearly shows music coverage).  
- [ ] Make small, targeted copy updates where multimodal data offers clearer language (e.g. “Most viewers drop during your hook” vs “in the intro”).  
- [ ] Update docs (`docs/iteration_4_e2e.md`, `docs/iteration_5_prd_mvp_status.md`) to:
  - [ ] Note that performance overlays now align to multimodal narrative beats.  
  - [ ] Call out any known limitations.  

**Constraints**

- Keep changes small and grounded; no redesign of the Performance tab in this iteration.  
- Don’t promise creative outcomes (views, subs) beyond what the data actually supports.  

**Acceptance Criteria**

- [ ] Manual E2E pass in performance mode shows consistent messaging between Narrative, Sound, and Performance tabs.  
- [ ] Updated docs clearly describe how retention vs beats is computed and interpreted.  

---

## Phase 3: Regression Suite, Golden Set, and Plan Completion

### Task 3.1: Golden Set – Lock In Multimodal Baselines

**Context**

- Iteration 2 defined a small golden video set and a script to run multimodal analyses.  
- With v2 as the default, these golden checks should become part of regular regression safeguards.  

**Goals**

- [x] Promote the golden-set script (`scripts/run-multimodal-golden.ts` or similar) to a maintained regression tool by:
  - [x] Making it runnable via an npm script (e.g. `npm run golden:multimodal`).  
  - [x] Documenting how to run it with real keys and what output to look for.  
- [x] Extend checks (or add assertions) so they explicitly test:
  - [x] Story presence correctly reflects narrative-heavy vs tutorial-style videos.  
  - [x] Music coverage and `music_changes` align with human expectations.  
  - [x] At least one “unobserved” case is handled gracefully.  
- [ ] Optionally integrate a lightweight version into CI (guarded by an env flag) that runs against mocked Gemini responses.  

**Constraints**

- Golden-set runs that hit real APIs should be opt-in and documented, not required for every CI run.  
- Keep any CI-friendly variant deterministic by mocking Gemini responses.  

**Acceptance Criteria**

- [x] Golden-set script runs successfully in a dev environment with real keys, producing readable logs.  
- [x] Developers can use it to spot regressions after changes to multimodal prompts, schema, or analyzers.  
- [x] A short section in `docs/multimodal_golden_set.md` (or iteration 2 E2E doc) describes how to use the script.  

---

### Task 3.2: Update Plan & PRD Status Docs to Reflect v2 Reality

**Context**

- `docs/analysis_functionality_plan.md` describes the target multimodal behaviour.  
- `docs/iteration_5_prd_mvp_status.md` captures PRD status before the upgrade.  
- After Iterations 1–3 of the upgrade track, both need to be reconciled with the new implementation.  

**Goals**

- [x] Update `docs/analysis_functionality_plan.md` to:
  - [x] Mark which steps are **fully implemented** and which were adjusted during real-world implementation (e.g., any nuances around `file_data` entitlement).  
  - [x] Note the final flag strategy and any deviations from initial assumptions.  
- [x] Add a short addendum or new section to `docs/iteration_5_prd_mvp_status.md` (or a new `iteration_6_multimodal_status.md` if preferred) that:
  - [x] Confirms FR‑5–FR‑15 are now backed by the multimodal pipeline.  
  - [x] Highlights any behaviour changes (e.g., better story/music detection, new diagnostics).  
- [x] Ensure `docs/axes_and_domains.md` remains the single source for axis semantics and is linked from Overview and any relevant debug views.  

**Constraints**

- Keep docs concise but precise; avoid duplicating large sections across files.  
- Ensure no doc still describes the text-only pipeline as the primary implementation.  

**Acceptance Criteria**

- [x] A new or updated status doc clearly describes the state of multimodal analysis vs the PRD.  
- [x] New contributors can read `README.md` + the plan doc and understand that multimodal is the default, with clear notes on fallbacks.  

---

### Task 3.3: Clean Up Debug Paths & Developer Experience

**Context**

- Iteration 1 added a multimodal debug view (`/dev/multimodal`) for diagnostics.  
- With v2 now standard, debug tooling should remain useful but not confusing.  

**Goals**

- [x] Review `/dev/multimodal` (or equivalent) and ensure it:
  - [x] Clearly indicates that it’s exercising the **same** pipeline used by `/api/analyze`.  
  - [x] Shows whether `file_data` or fallback was used, plus counts of `unobserved` metrics.  
  - [x] Links to `docs/axes_and_domains.md` for axis definitions.  
- [x] Trim any debug-only features that rely on the old text-only path or outdated schemas.  
- [x] Update README or a small dev doc to explain how to:
  - [x] Run the app in mock vs Gemini vs performance modes.  
  - [x] Use the debug view and golden-set script when changing prompts or schema.  

**Constraints**

- Debug views must remain protected / dev-only; no sensitive information in logs or UI.  

**Acceptance Criteria**

- [x] Developers can reliably use `/dev/multimodal` to inspect end-to-end multimodal runs without confusion about which path is active.  
- [x] All references to obsolete debug endpoints or v1-only behaviour are removed or clearly marked as deprecated.  

---

## Phase Transition Checklist (Iteration 3 – Multimodal Launch & Integration)

Use this checklist to confirm Iteration 3 of the **upgrade track** is complete and the Native Multimodal Analysis Plan is fully realized in the product.

### ✅ Multimodal as the Default

- [ ] `diagnostics.source = 'gemini-v2-multimodal'` for standard creative analyses in Gemini mode.  
- [ ] Any v1 text-only path is either removed or clearly isolated as a guarded fallback.  

### ✅ Canonical Fingerprint & References

- [ ] `VideoFingerprintJson` v2 is the single, canonical fingerprint schema, used by analysis, similarity, and UI.  
- [ ] Reference library fingerprints have been regenerated with the multimodal pipeline and seeds updated.  
- [ ] “Closest neighbours” and “Where you’re unusual” operate correctly on v2 axes.  

### ✅ Performance Overlay Harmony

- [ ] Narrative beats from the multimodal pipeline are aligned with retention curves in Performance mode.  
- [ ] Performance copy and micro-insights remain accurate and consistent with Narrative/Sound tabs.  

### ✅ Regression & Docs

- [x] Golden-set script is usable by developers to detect regressions in story/music/editing detection.  
- [x] Plan and PRD status docs are updated to reflect the multimodal implementation and flag strategy.  
- [x] Debug views and README clearly describe how to run and inspect the multimodal pipeline.  

When all of the above are ticked, the **Native Multimodal Analysis Plan** (`docs/analysis_functionality_plan.md`) is effectively **complete**: every creative analysis in CreatorSight uses Gemini’s multimodal view of the video, fingerprints and similarity are grounded in the new metrics, and both creators and developers can trust and understand what the system is doing.
