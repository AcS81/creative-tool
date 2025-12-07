
# CreatorSight – Iteration 1 Implementation Tasks (Multimodal Analysis)

## Document Information

- **Iteration**: 1 (Multimodal Analysis Core)
- **Version**: 1.0  
- **Created**: 7 Dec 2025  
- **Status**: Ready for AI-Driven Implementation  

> **Scope of this iteration**: Implement the new **multimodal Gemini pipeline** (YouTube URL via `file_data` + unified JSON schema) and wire it into the existing analysis architecture behind a feature flag. This iteration delivers a **working, testable end-to-end path** from YouTube URL → Gemini multimodal call → validated JSON → updated fingerprint, with a minimal developer-facing UI for verification. Further UX polish, archetype UX, and performance overlays will land in later iterations.

---

## Overview

This document breaks the **Native Multimodal Analysis Plan** and relevant parts of the MVP PRD into actionable, ordered tasks for **Iteration 1**.

Each task is a **vertical slice**: if you complete Tasks 0.1 → 2.2 in order, you will:

- Call Gemini 1.5 Pro multimodally using `file_data` for YouTube URLs with a structured JSON response.
- Validate and parse the returned JSON into existing domain models and a `VideoFingerprintJson`.
- Expose a minimal internal UI to trigger the new pipeline and inspect diagnostics.

**Implementation Strategy**

- Prioritise **vertical slices** (end-to-end path for one video) over horizontal work (e.g., all schema, then all UI).
- Keep the new pipeline **feature-flagged** (`analysis_v2_multimodal`) so you can compare it against the existing text-only flow.
- Use the **RunnieResume Iteration 1 tasks doc** as structure: context, goals, constraints, acceptance criteria, manual tests.

---

## Phase 0: Multimodal Core & Entitlement Handling

### Task 0.1: Gemini Multimodal Client Rewrite (`file_data` + Fallback)

**Context**

- Plan Section: 1) Reality Check, 2) Architecture, 3) API Call Design, 6.1 Implementation Step 1.
- PRD Section: 5.3 Gemini-based Analysis (FR-5–FR-11) – same domains, new call style.
- Current State: Existing Gemini client makes **multiple text-only calls** per domain using YouTube URL as plain text (higher hallucination risk).  
- Goal: Replace with a **single multimodal client** that:
  - Uses `file_data` with the YouTube URL for native video ingestion.
  - Detects entitlement/403 and falls back to a temp-upload flow without persisting media.  

**Goals**

- [ ] Implement `src/lib/gemini/client.ts` v2 that:
  - [ ] Accepts `{ youtubeUrl, prompt, jsonSchema }`.
  - [ ] Builds a `contents` payload with:
    - `file_data`: `{ mime_type: "video/mp4", file_uri: youtubeUrl }`
    - `text`: combined system + user instructions.  
  - [ ] Sets `responseMimeType: "application/json"`, `temperature: 0.2`.  
- [ ] Implement entitlement detection:
  - [ ] If Gemini rejects `file_data` (403/unsupported) **once**, fall back to a **temp upload path**:
    - [ ] Stream audio + sparse frames for the URL.
    - [ ] Upload via a signed URL as a `FilePart`.
    - [ ] Re-call Gemini with that FilePart.  
  - [ ] Ensure temp media is deleted immediately after the call completes or fails.
- [ ] Return a structured result type:
  - [ ] `{ ok: true, fromFallback: boolean, rawJson: unknown }` or `{ ok: false, errorCode, errorMessage }`.
- [ ] Add **feature flag** support (e.g. `analysis_v2_multimodal`) so consumers can opt into this client.

**Constraints**

- Do **not** persist raw media (audio, frames, full video) beyond the lifetime of the analysis call (aligns with PRD privacy constraints).  
- Only **one multimodal Gemini call per analysis job** – no per-domain fan-out calls.  
- Keep the new client **backwards compatible**:
  - New functions should coexist with the current text-only client until Iteration 2 removes the old path.
- Log entitlement failures with enough context for debugging, but avoid logging video content or any PII.

**Acceptance Criteria**

- [ ] A call with a valid, publicly reachable YouTube URL succeeds using `file_data` and returns JSON.  
- [ ] A call where `file_data` is forbidden triggers the fallback path exactly once, then:
  - [ ] Uses temp upload and returns JSON if successful.
  - [ ] Marks `fromFallback: true`.  
- [ ] On any fatal error, the client returns `{ ok: false, errorCode, errorMessage }` without throwing uncaught exceptions.
- [ ] No temp media files remain on disk or in storage after the request completes (success or error).
- [ ] Feature flag can disable the new path, restoring the old analysis client behaviour.

**Manual Test**

1. Call the client with a normal public YouTube URL (staging/dev key) and verify:
   - Response `ok: true`, `fromFallback: false`, `rawJson` present.
2. Force a `file_data` entitlement failure (e.g., by using a test project without YouTube entitlement or stubbing the response):
   - Confirm the temp-upload fallback runs once.
   - Confirm `fromFallback: true` is surfaced to caller.
3. Intentionally break the YouTube URL (404 or invalid format):
   - Confirm the client returns `ok: false` with a meaningful `errorCode` (`INVALID_URL` or `UNREACHABLE_VIDEO`).
4. Inspect logs:
   - Ensure no raw media paths/URLs persist longer than necessary.
   - Ensure errors are logged with sufficient but non-sensitive context.

**Task Complete When**

- [ ] All acceptance criteria met.
- [ ] Code merged behind feature flag.
- [ ] Client API documented in a short doc block / `docs/iteration_1/task_0_1_gemini_client.md`.

---

### Task 0.2: Unified JSON Schema & Zod Validation Module

**Context**

- Plan Section: 4) JSON Schema – unified, single source of truth.  
- PRD Section: 5.3 Gemini-based Analysis – voice, language, narrative, visual/edit/sound outputs used for the fingerprint.  
- Current State: Each domain likely has its own ad-hoc types; analysis outputs may be loosely typed or partially overlapping.

**Goals**

- [ ] Define a TypeScript **interface hierarchy** for the multimodal response, based exactly on the JSON schema in the plan:
  - `VoiceMetrics`, `LanguageMetrics`, `NarrativeMetrics`, `VisualEditSoundMetrics`, etc.  
  - Include `beats` with timestamps and labelled segments.
- [ ] Implement a `zod` schema (`GeminiMultimodalResponseSchema`) that:
  - [ ] Mirrors the JSON schema structure (keys, nested fields, types).
  - [ ] Enforces `score: number (0–100)`, `value: string`, `explanation: string` for all metrics.
  - [ ] Allows `value: "unobserved"` with `score: 0` when metrics are not measurable.  
- [ ] Create a validator utility in `src/lib/analysis/validators/geminiMultimodal.ts` exposing:
  - [ ] `parseGeminiMultimodalJson(raw: unknown): GeminiMultimodalResponse`.
  - [ ] `isGeminiMultimodalResponse(raw: unknown): raw is GeminiMultimodalResponse`.
- [ ] Define a **narrow error type** for schema violations (e.g. `InvalidGeminiResponseError`) that reports which domain/metric failed.

**Constraints**

- Schema must be **forward-compatible** with minor additions (e.g., new metrics) but strict about required existing fields.
- No “Axis 4/5 placeholder” or dummy fields; only actual metrics described in the plan.  
- All types exported from a central barrel file (e.g. `src/lib/analysis/types/index.ts`) to be reusable by fingerprint builder and UI.

**Acceptance Criteria**

- [ ] TypeScript interfaces compile without errors and cover all metrics in the JSON example in the plan.  
- [ ] `GeminiMultimodalResponseSchema` successfully validates a sample response based on the plan’s JSON snippet.
- [ ] Invalid responses (missing domain, wrong type, missing beats) fail with a clear error listing the failing path (`"voice.speaking_rate.score"` etc.).
- [ ] Validator utility is unit-tested:
  - [ ] Happy path with a valid mock response.
  - [ ] Several negative tests (missing fields, wrong types, extra unknown top-level domain).

**Manual Test**

1. Create a mock JSON file matching the plan’s example and run it through `parseGeminiMultimodalJson`:
   - Confirm a strongly typed `GeminiMultimodalResponse` is returned.
2. Remove `language.concreteness` from the mock:
   - Confirm the validator throws an `InvalidGeminiResponseError` pointing at that metric.
3. Set `value: "unobserved"` and `score: 0` for several metrics:
   - Confirm validation passes.
4. Confirm IDE autocompletion works for all metric keys across domains.

**Task Complete When**

- [ ] All acceptance criteria met.
- [ ] Schema and types merged and referenced in at least one place (e.g., upcoming Task 1.1).
- [ ] Basic README/TSDoc notes added explaining the response contract.

---

## Phase 1: Domain Consolidation & Fingerprint Mapping

### Task 1.1: Consolidated Domain Analyzer Using a Single Multimodal Call

**Context**

- Plan Section: 2) Architecture, 3) API Call Design, 6.2 Implementation Step 2.  
- PRD Section: FR-5–FR-11 – previously implemented via multiple domain-specific calls.  
- Current State: `src/lib/analysis/geminiDomains.ts` (or equivalent) likely orchestrates **six text-only calls** and merges outputs.

**Goals**

- [ ] Implement a new module (e.g. `src/lib/analysis/geminiMultimodalAnalyzer.ts`) that:
  - [ ] Uses the **new client** from Task 0.1.
  - [ ] Uses the **schema/validator** from Task 0.2.
  - [ ] Performs **one** multimodal call per video analysis job.
- [ ] Map the validated multimodal JSON into **domain profiles**:
  - [ ] `VoiceProfile`, `LanguageProfile`, `NarrativeProfile`, `VisualEditSoundProfile` etc., as used by the rest of the app.
  - [ ] Include beats/timeline info as part of `NarrativeProfile`.
- [ ] Add a feature flag–controlled switch in the existing orchestration code:
  - [ ] When `analysis_v2_multimodal` is enabled:
    - [ ] Bypass the old text-only path and call the new multimodal analyzer.
  - [ ] Otherwise:
    - [ ] Preserve old behaviour.

**Constraints**

- No changes to the **public API** of whatever function currently returns the domain profiles to the rest of the app; only the internal implementation changes.
- Preserve semantics of FR-5–FR-11: the same conceptual outputs (voice, language, narrative, visual, editing, sound) must be derivable from the multimodal response.  
- Treat missing/unobserved metrics as **low-confidence values** but do not crash; caller should still receive partial domain profiles.

**Acceptance Criteria**

- [ ] Existing consumers of domain profiles compile and run without changes to their import signatures.
- [ ] A “golden path” video can be analyzed via the feature-flagged pipeline and produces domain profiles for all required domains.
- [ ] If Gemini returns `unobserved` metrics:
  - [ ] The relevant fields in the domain profiles are marked/flagged as low-confidence.
  - [ ] The analyzer returns successfully rather than failing hard.
- [ ] The old text-only path is still callable when the feature flag is disabled.

**Manual Test**

1. Pick one test YouTube URL and run it through:
   - a) Existing text-only analyzer.
   - b) New multimodal analyzer (flag on).
   - Compare outputs for basic sanity (e.g. voice intensity not wildly divergent).
2. Introduce a schema error in the mock Gemini response:
   - Confirm the analyzer surfaces a clean error (from validator) and does not corrupt domain profiles.
3. Toggle the feature flag off:
   - Confirm the system falls back to the old path with no TypeScript/runtime errors.

**Task Complete When**

- [ ] All acceptance criteria met.
- [ ] Code merged with feature flag defaulting to **off** in production, **on** in dev/staging.
- [ ] Short dev note added: how to enable analysis v2 locally.

---

### Task 1.2: Fingerprint Builder v2 (`VideoFingerprintJson`)

**Context**

- Plan Section: 2) Architecture (Post-process), 4) JSON Schema, 6.3–6.4 Implementation Steps 3 & 4.  
- PRD Section: 5.5 Fingerprint & Similarity (FR-14, FR-15); 4.1 Overview radar chart & per-domain visualisations depend on this.  
- Current State: Fingerprint implementation may be tuned for text-only metrics and split per-domain.

**Goals**

- [ ] Design and implement a new `VideoFingerprintJson` structure that:
  - [ ] Aggregates all domains from the **multimodal response** into:
    - Meta axes (voice intensity, conceptual depth, narrative structure strength, visual dynamism, production polish).  
    - Per-domain scores and key metrics (e.g., cut_rate, music_changes, filler_rate).
    - Beats/timeline information needed by later visualisations.
  - [ ] Lives in a dedicated module, e.g. `src/lib/analysis/fingerprint/videoFingerprint.ts`.
- [ ] Implement a builder function:
  - [ ] `buildVideoFingerprint(response: GeminiMultimodalResponse, domainProfiles: DomainProfiles): VideoFingerprintJson`.
- [ ] Ensure `VideoFingerprintJson` remains compatible with:
  - [ ] Existing similarity engine (or stub it where not yet implemented).
  - [ ] Planned overview / domain views defined in the PRD.  

**Constraints**

- Do **not** change the storage contract for fingerprints in the database unless necessary; if schema changes are needed:
  - Version them (e.g. `schemaVersion: 2`) and support both v1 and v2 in read paths.
- Meta axes must derive from actual metrics – no arbitrary values.
- Ensure numeric ranges are normalized (e.g., 0–100) for radar chart consumption later.

**Acceptance Criteria**

- [ ] `VideoFingerprintJson` type defined and exported from a central `types` module.
- [ ] `buildVideoFingerprint`:
  - [ ] Can build a full fingerprint from a valid `GeminiMultimodalResponse`.
  - [ ] Produces meta axes aligned with PRD definitions (voice intensity, conceptual depth, etc.).  
- [ ] Existing consumers of fingerprints either:
  - [ ] Continue to function unchanged (if JSON shape is compatible), or
  - [ ] Are updated to handle v1 vs v2 fingerprints explicitly.
- [ ] Unit tests cover:
  - [ ] Happy path where all metrics are present.
  - [ ] Partial/unobserved metrics where axes degrade gracefully (e.g., defaulting to neutral or 0, with a low-confidence flag).

**Manual Test**

1. Use a mocked but realistic `GeminiMultimodalResponse`:
   - Run `buildVideoFingerprint` and inspect the resulting JSON.
   - Verify values for meta axes are plausible and respond to input changes.
2. Flip specific metrics (e.g., increase cut_rate, add more pattern_interrupts) in the mock:
   - Confirm the corresponding axes in the fingerprint change in expected directions.
3. Persist a v2 fingerprint alongside any existing v1 example in the DB:
   - Verify that the API/frontend reading fingerprints does not break.

**Task Complete When**

- [ ] All acceptance criteria met.
- [ ] Fingerprint builder wired into the analysis pipeline for the v2 path (but not yet surfaced in polished UI).
- [ ] Documentation note added describing how axes are derived.

---

## Phase 2: Metadata, Diagnostics & Minimal Developer UI

### Task 2.1: Axis Metadata Single Source of Truth

**Context**

- Plan Section: 4) JSON Schema (meta-axes and archetypes derive from scores), 6.3 Implementation Step 3.  
- PRD Section: 4.1 Overview and 4.3 Domain views – tooltips, labels and explanations draw from consistent metadata.  
- Current State: Axis labels/explanations may be duplicated between backend and frontend or scattered.

**Goals**

- [ ] Create a module `src/lib/analysis/axisMetadata.ts` that exports:
  - [ ] A canonical list of meta axes with:
    - `id`, `label`, `description`, `domain`, `valueRangeExplanation`.
  - [ ] Per-domain metric descriptions keyed by the JSON schema metric keys.
- [ ] Update the frontend to **consume axis metadata from this module** for:
  - [ ] Radar labels (global + per-domain).
  - [ ] Tooltips and short descriptions in any existing UI (even if still using v1 data).
- [ ] Ensure the new multimodal path uses the same metadata, avoiding duplication.

**Constraints**

- Metadata must be **non-localised but localisable** (plain English strings, no framework-coupled formatting).
- No hard-coded axis strings in components – everything reads from `axisMetadata.ts` (or a wrapper hook).
- IDs used here should align with current/future fingerprint keys so adding new visuals later doesn’t require renaming.

**Acceptance Criteria**

- [ ] There is exactly one module that defines axis labels & descriptions.
- [ ] All components that render axes/archetypes pull from this module (no duplicated copies).
- [ ] Adding a new axis in `axisMetadata.ts` automatically becomes available to the UI with minimal wiring.
- [ ] TypeScript enforces that metric IDs used in metadata correspond to actual keys in `VideoFingerprintJson` or response types.

**Manual Test**

1. Run the app and inspect any view that currently shows axes or tooltips:
   - Confirm labels/descriptions match the new metadata.
2. Intentionally tweak one axis description in `axisMetadata.ts`:
   - Confirm the UI reflects that change without further modifications.
3. Add a new “dummy” axis (behind a feature flag) to metadata:
   - Confirm it can be rendered in a local debug UI without breaking existing charts.

**Task Complete When**

- [ ] All acceptance criteria met.
- [ ] Axis metadata module is referenced in docs / code comments as the “single source of truth”.

---

### Task 2.2: Diagnostics & Minimal Multimodal Debug UI

**Context**

- Plan Section: 2) Architecture (post-process diagnostics), 6.5 Implementation Step 5, 7) Validation Plan.  
- PRD Section: 5.2 Reliability – partial results + clear flags when domains are missing or low confidence.  
- Current State: No dedicated UI to inspect raw multimodal outputs, fallback usage, or “unobserved” metrics.

**Goals**

- [ ] Add a **developer-only debug view** (e.g. `/dev/multimodal`) that:
  - [ ] Accepts a YouTube URL input.
  - [ ] Lets you toggle `analysis_v2_multimodal` flag.
  - [ ] Shows:
    - Whether the analysis used **primary `file_data`** or **fallback**.
    - High-level timing info (client call duration).
    - Count of `unobserved` metrics per domain.
    - A collapsible JSON view of the validated `GeminiMultimodalResponse` and resulting `VideoFingerprintJson` (redacted of sensitive info).
- [ ] Ensure diagnostics include a “lower confidence” banner if:
  - [ ] Fallback path was used, or
  - [ ] More than a configurable % of metrics are `unobserved`.
- [ ] Reuse axis metadata for human-friendly labels in this view.

**Constraints**

- Debug view must be:
  - Protected in production (e.g., feature flag + admin guard) or excluded from prod build if necessary.
  - Careful not to expose internal API keys, raw headers, or any secrets.
- JSON inspector should be read-only; no editing of live data through this screen.

**Acceptance Criteria**

- [ ] Visiting `/dev/multimodal` in a dev environment shows a basic page with:
  - [ ] YouTube URL input.
  - [ ] “Run analysis” button.
  - [ ] Feature flag toggle.
- [ ] Running a valid URL:
  - [ ] Triggers the v2 pipeline.
  - [ ] Renders a summary: used fallback or not, call duration, number of `unobserved` metrics.
  - [ ] Renders collapsible JSON panes for response and fingerprint.
- [ ] When fallback is used OR `unobserved` metrics exceed threshold:
  - [ ] A “lower confidence” diagnostic message appears.
- [ ] Page is hidden or guarded in production as per your security policy.

**Manual Test**

1. In dev, open `/dev/multimodal`:
   - Enter a valid YouTube URL and run analysis.
   - Verify the primary `file_data` path is used (no fallback) and metrics counts look sane.
2. Force fallback (using the same technique as Task 0.1 test):
   - Confirm the debug view shows `fromFallback: true` and a “lower confidence” message.
3. Modify the mock response to set many metrics to `unobserved`:
   - Confirm the “lower confidence” message appears even without fallback.
4. Try accessing `/dev/multimodal` in a prod-like environment:
   - Confirm access is blocked or appropriately guarded.

**Task Complete When**

- [ ] All acceptance criteria met.
- [ ] Debug view documented for other developers (how to use it to validate future changes).
- [ ] Iteration 1 is deliverable: a complete, testable multimodal analysis pipeline with minimal UI and diagnostics.

---

## Phase Transition Checklist (Iteration 1)

Use this to confirm Iteration 1 is **done** before moving to Iteration 2 (which will likely focus on full UX, archetypes, and similarity UI):

### ✅ Phase 0: Multimodal Core

- [ ] Gemini client supports `file_data` + fallback without persisting media.  
- [ ] `GeminiMultimodalResponseSchema` + validator correctly parse/validate model JSON.

### ✅ Phase 1: Domain & Fingerprint

- [ ] Single multimodal call replaces per-domain fan-out (behind feature flag).  
- [ ] `VideoFingerprintJson` v2 is generated from multimodal outputs and accessible to the app.  

### ✅ Phase 2: Metadata & Diagnostics

- [ ] Axis metadata has a single source of truth consumed by UI.  
- [ ] Developer debug view exists for multimodal analysis & diagnostics.  

Once all boxes are ticked, you’ve completed **Iteration 1** and can define **Iteration 2** tasks (UI overhaul, archetype cards, similarity visualisation, performance overlay) in a follow-up tasks document using the same structure as here and the RunnieResume example.
