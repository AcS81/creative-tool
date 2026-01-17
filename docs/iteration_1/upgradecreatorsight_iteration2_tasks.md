# CreatorSight – Iteration 2 Implementation Tasks (Multimodal UX & Trust)

## Document Information

- **Product**: CreatorSight  
- **Upgrade Track**: Native Multimodal Analysis  
- **Iteration**: 2 – “Explain it like a creator”  
- **Version**: 1.0  
- **Status**: Draft – Ready to Implement once Iteration 1 is essentially green  

> **Scope of this iteration**: Build on the **Iteration 1 multimodal core** (`callGeminiMultimodalJson`, unified JSON schema, feature-flagged pipeline) and turn it into something a real creator can *trust and understand*. That means:
> - The system must genuinely “see/hear” the video.  
> - Axes must be clearly defined (no “Axis 4/5”), with hover/click explanations.  
> - Each domain tab should *explain* the result in words, not just show bars and shapes.  
> - Story presence and soundscape (esp. background music) must be believable on real test videos.

This iteration assumes **Iteration 1 of the upgrade track** (see `docs/upgradecreatorsight_iteration1_tasks.md`) has delivered:

- A working `callGeminiMultimodalJson` client with URL ingestion (no download/upload fallback).  
- A `GeminiMultimodalResponse` schema + validator.  
- A v2 `VideoFingerprintJson` builder wired into a feature-flagged analysis path.  
- A basic debug view for multimodal diagnostics.

If any of those are missing, treat the relevant Iteration 1 tasks as prerequisites.

---

## Phase 0: Reality Check – Does Gemini Actually See the Video?

> Goal: Close the gap between the **PRD assumption** (“Gemini can understand a YouTube URL”) and what the **API actually does**, then bake that reality into our pipeline and docs.

### Task 0.1: Hard-Validate the Multimodal Ingestion Path

**Context**

- PRD FR-5–FR-11 assume Gemini has genuine multimodal access (audio + frames).  
- `src/lib/gemini/client.ts` currently uses URL ingestion (YouTube URL input only).  

**Goals**

- [ ] Create a **small internal script or test harness** (can live next to the debug view) that:
  - [ ] Calls `callGeminiMultimodalJson` for a *real* public video using URL ingestion and inspects whether Gemini returns believable video-derived metrics (e.g., detects obvious music or visual setup changes).
- [ ] From these experiments, document in `docs/analysis_functionality_plan.md`:
  - [ ] Whether URL ingestion is supported for your account/model, or consistently rejected.  
  - [ ] Any entitlement or quota notes that affect reliability.

**Constraints**

- No production secrets or keys in the docs.  
- If behaviour differs per project/entitlement, note that and design for configuration, not assumptions.

**Acceptance Criteria**

- [ ] A short “Multimodal Reality” subsection added to `docs/analysis_functionality_plan.md` summarising:
  - What actually works today (URL ingestion + entitlement notes).  
  - Confirmation that download/upload fallbacks are not used.  
- [ ] At least one **golden test video** (see Phase 2) shows clearly better transcript / scene / music detection when the real multimodal path is used, compared with the old text-only URL prompt.  

---

## Phase 1: Metric Semantics & Axis Metadata (Single Source of Truth)

> Goal: Every bar, radar axis, and label in the UI is backed by a clear definition and direction (“higher means X”), so creators know what they’re looking at.

### Task 1.1: Domain Metric Catalogue & Axis Metadata

**Context**

- PRD Sections: 4.2–4.3 domain views; 5.3 FR-6–FR-11.  
- `docs/analysis_functionality_plan.md` already sketches metric names like `speaking_rate`, `concreteness`, `cut_rate`, `music_changes`, etc.  
- Existing code has *partial* axis labels scattered in:
  - `src/lib/analysis/geminiDomains.ts` (`defaultScores` per domain).  
  - `src/components/RadarChartOverview.tsx` (meta-axis labels/descriptions).  
  - `src/components/DomainRadar.tsx` (pads with “Axis 4/5”).  

**Goals**

- [ ] Implement `src/lib/analysis/axisMetadata.ts` as the **canonical catalog** of axes and metrics:
  - [ ] Define a `DomainKey`-aware type (reusing `DomainKey` from `src/lib/archetypes/descriptions.ts`) and an `AxisId` type (e.g. `"voice.speaking_rate"`).  
  - [ ] For each domain-level metric you intend to use in multimodal responses, add:
    - `id` – stable key, e.g. `"voice.speaking_rate"`.  
    - `domain` – `"voice" | "language" | "narrative" | "visual" | "editing" | "sound"`.  
    - `label` – short label (“Speech pace”, “Cut rate”).  
    - `shortDescription` – 1–2 lines on what is measured.  
    - `howMeasured` – plain-language description (e.g., “Approx. words per minute across the video”).  
    - `scaleDirection` – what “low” vs “high” mean (e.g., `"low=slow, high=fast"`).  
  - [ ] Include entries for **meta axes** as well (voiceIntensity, conceptualDepth, etc.), instead of defining them inline in `RadarChartOverview`.  
- [ ] Ensure metric IDs correspond to keys in the multimodal JSON schema and in `DomainProfile.scores`:
  - [ ] E.g., a `DomainScore.key` of `"voice.speaking_rate"` is guaranteed to have metadata in `axisMetadata`.

**Constraints**

- No duplicated hard-coded axis descriptions in components; they all read from `axisMetadata`.  
- Strings are plain English and can be internationalised later; no framework-specific formatting.

**Acceptance Criteria**

- [ ] `axisMetadata.ts` contains:
  - [ ] Meta axes (Overview radar).  
  - [ ] Per-domain axes aligned with the PRD metrics list (voice, language, narrative, visual, editing, sound).  
- [ ] A small unit test verifies that every `DomainScore.key` used in a sample `VideoFingerprintJson` resolves to metadata.  
- [ ] `src/components/RadarChartOverview.tsx` no longer declares its own label/description maps; it imports them from `axisMetadata.ts`.

---

### Task 1.2: Map Multimodal JSON → Domain Scores + Axis Metadata

**Context**

- Iteration 1 defined a `GeminiMultimodalResponse` JSON shape (see `docs/analysis_functionality_plan.md`).  
- `src/lib/types/fingerprint.ts` still defines `DomainProfile.scores` as `[ { key, label, value } ]` only – no per-axis explanations.  
- We want the *raw* multimodal metrics (e.g. `"160 wpm"`, “music under 70% runtime”) preserved, and the same axis IDs reused across:
  - The analyzer.  
  - The fingerprint.  
  - The UI tooltips.

**Goals**

- [ ] Extend the multimodal analyzer (e.g. `src/lib/analysis/geminiMultimodalAnalyzer.ts` from Iteration 1) to:
  - [ ] Map each metric in the multimodal response into a `DomainScore` whose `key` matches an entry in `axisMetadata`.  
  - [ ] Preserve the *raw* measurement and short explanation per metric in an auxiliary structure, e.g.:
    - Either by extending `DomainProfile` (e.g., `scoreDetails: Record<string, { rawValue: string; explanation: string }>`), **or**  
    - By adding a `supporting.axisDetails` object onto `VideoFingerprintJson`.  
  - [ ] Ensure **no metrics are silently dropped**; if a metric is not used in scores, keep it in `supporting` for future visuals.

**Constraints**

- Don’t break existing consumers of `VideoFingerprintJson`; new fields should be additive and optional.  
- If a metric is marked `unobserved` in the multimodal response, populate `score.value = 0` but record the unobserved status in `supporting.axisDetails` so the UI can show “Not observed” instead of “0/100 = bad”.

**Acceptance Criteria**

- [ ] For a mocked `GeminiMultimodalResponse`, the analyzer produces:
  - [ ] `DomainProfile.scores` with `key`s that all exist in `axisMetadata`.  
  - [ ] A `supporting.axisDetails` (or equivalent) mapping each `key` to `{ rawValue, explanation, observed: boolean }`.  
- [ ] The fingerprint schema and types compile and tests pass.  
- [ ] A test confirms that changing a raw metric (e.g., increasing `music_changes`) flows through to both:
  - The numeric score in the fingerprint.  
  - The human description attached to that axis.

---

## Phase 2: Domain UX – Text That Actually Explains the Results

> Goal: When a creator opens any of the domain tabs (Voice, Language, Narrative, Visual, Editing, Sound), they see *words* explaining what’s going on, and can hover over axes to understand how each is computed.

### Task 2.1: Domain Radar Tooltips & Axis Explanations

**Context**

- The Overview radar already has a tooltip + descriptions (`RadarChartOverview.tsx`), but domain radars (`DomainRadar.tsx`) do not.  
- `DomainRadar` currently pads missing axes with `Axis 4/5`, which showed up in your tests and feels broken.

**Goals**

- [ ] Update `src/components/DomainRadar.tsx` to:
  - [ ] Build its data set from `DomainProfile.scores` *without* inventing “Axis 4/5”. If there are only 3–4 scores, the radar simply has 3–4 axes.  
  - [ ] Attach metadata from `axisMetadata`:
    - Each point carries `axisId`, `label`, `shortDescription`, `howMeasured`, `scaleDirection`.  
  - [ ] Add a `Tooltip` (similar to `RadarChartOverview`) that, on hover, shows:
    - Axis label.  
    - `value / 100`.  
    - A 1–2 sentence explanation pulled from metadata and/or `supporting.axisDetails`.  
  - [ ] Optionally show a subtle legend under the radar listing each axis with its short description.

**Constraints**

- No placeholder axis labels; if an axis doesn’t have metadata, treat that as a developer error (log and omit it).  
- Keep visual density reasonable on small screens (e.g., only show detailed text on tooltip, not all at once).

**Acceptance Criteria**

- [ ] On each domain tab, hovering over a radar point shows:
  - A clear label (“Cut rate”), numeric score, and text like “Shorter average shot length = faster pacing.”  
- [ ] `Axis 4` / `Axis 5` **never** appears in the UI.  
- [ ] Removing or renaming an axis in `axisMetadata` is the only place needed to keep radar tooltips in sync.

---

### Task 2.2: Axis List + “What This Means” Section Per Domain

**Context**

- `DomainView.tsx` currently shows:
  - Archetype title + description (using `describeArchetype`).  
  - A radar (if provided).  
  - Horizontal score bars.  
  - Tags and optional “Domain insights”.  
- In user tests, this read as “bars, shapes, and tags” without enough narrative explanation.

**Goals**

- [ ] Extend `DomainScoreBars` and `DomainView` so each domain tab has a clear “What this means” section:
  - [ ] For each axis/score:
    - Show label + `value/100`.  
    - Show a short explanation sentence (from `axisMetadata` + `supporting.axisDetails`). Example:
      - “Cut rate – 78/100: frequent cuts early, slightly slower later.”  
  - [ ] Include a brief 2–3 bullet “Summary for this domain” below the archetype description:
    - E.g., for Voice: “Fast but clear,” “Few filler words,” “Mostly steady emotional tone.”  
    - These bullets can be generated by the analyzer or derived from the axis values.

**Constraints**

- Use existing `DomainProfile.summaryText` and archetype descriptions as the *headline*; bullets and per-axis text should feel like elaboration, not repetition.  
- Keep copy concise; this is not a long essay, just enough to orient the creator.

**Acceptance Criteria**

- [ ] For each domain, the tab displays:
  - Archetype + 1–2 sentence description.  
  - Radar with hover tooltips.  
  - A list of axes, each with:
    - Label, numeric score, and one explanatory sentence.  
  - 2–3 bullet “Domain summary” items.  
- [ ] A test (snapshot or DOM-based) confirms that for a sample fingerprint the domain tab contains at least one explanatory sentence per axis.

---

### Task 2.3: Narrative Timeline & Soundscape Clarity

**Context**

- User feedback:  
  - Narrative tab sometimes said “no story presence” on a story-heavy video.  
  - Sound tab failed to acknowledge clear background music.  
- `DomainTimeline.tsx` currently renders beats or transcript segments but doesn’t differentiate narrative roles (hook, setup, payoff) or sound changes.

**Goals**

- [ ] Enhance the narrative representation:
  - [ ] Extend the multimodal schema and analyzer to mark beats with roles (`hook`, `setup`, `escalation`, `payoff`, `outro`, etc.) and devices (foreshadowing, callbacks, pattern interrupts) in line with the PRD.  
  - [ ] Teach `DomainTimeline` to display these roles (e.g., labels/colour or small badges) so you can *see* where hook/setup/payoff happen.  
- [ ] Make soundscape analysis explicit:
  - [ ] Ensure multimodal response includes:
    - Approx % of runtime with background music.  
    - Number of music changes.  
    - Basic mood and loudness vs voice.  
  - [ ] Surface this in the Sound domain tab as clear text:
    - “Music under ~70% of the video with 3 track changes; mostly upbeat and under the voice.”  

**Constraints**

- Keep `VideoFingerprintJson` additions backward-compatible (new optional fields).  
- Don’t assume story or music – if genuinely absent, say so explicitly (“No consistent music bed detected”).

**Acceptance Criteria**

- [ ] On a video with obvious story beats and music:
  - Narrative tab shows at least hook + payoff clearly positioned in the timeline.  
  - Sound tab reports non-zero music coverage and references its character.  
- [ ] On a talking-head tutorial with no music:
  - Sound tab clearly says that no background music was detected, rather than mislabelling it.  
- [ ] These behaviours are verified on at least two of the golden test videos from Phase 3.

---

## Phase 3: Quality & Trust – Golden Set and Regression Checks

> Goal: Move from “it runs” to “it’s reliable enough that a creator doesn’t feel gaslit by the analysis.”

### Task 3.1: Define a Small Golden Video Set

**Context**

- The PRD and your feedback both emphasize **real-world accuracy** (story presence, music presence, etc.).  
- We need a repeatable set of videos to sanity-check future changes.

**Goals**

- [ ] Create or update `docs/iteration_2_e2e.md` (or a new `docs/multimodal_golden_set.md`) to include:
  - [ ] 3–5 specific public YouTube URLs with short human notes:
    - Video A: “Strong story arc, no music.”  
    - Video B: “Heavy continuous background music, weak narrative.”  
    - Video C: “Multiple narrative mini-arcs, occasional music stings.”  
  - [ ] For each video, list **expected qualitative outcomes**:
    - Story presence high/medium/low.  
    - Approx music coverage (none / light / heavy).  
    - Editing pace (slow/medium/fast).  

**Acceptance Criteria**

- [ ] Golden set doc exists and is easy to follow.  
- [ ] Future devs can re-run analyses on these URLs and compare outputs to expectations as a manual QA step.

---

### Task 3.2: Lightweight Evaluation Script for the Golden Set

**Context**

- Iteration 1 already added a multimodal debug view. We now want a script-level check that doesn’t depend on UI.

**Goals**

- [ ] Add a small Node script or test helper (e.g. `scripts/run-multimodal-golden.ts` or a Vitest suite) that:
  - [ ] Iterates over the golden set URLs.  
  - [ ] Calls the **multimodal pipeline** (not the old text-only one) to produce fingerprints.  
  - [ ] Logs or asserts simple properties, e.g.:
    - `soundProfile.scores.musicCoverage > 50` for the music-heavy video.  
    - `narrativeProfile.scores.storyPresence > X` for the story video.  
    - `editingProfile.scores.cutPace` differences between slow vs fast-cut examples.

**Constraints**

- Keep the script safe to run in dev only (guard with env flag or separate npm script).  
- Tests should use *tolerances* (ranges), not exact numbers, to allow LLM variance.

**Acceptance Criteria**

- [ ] Running the script (with real keys) prints or asserts metrics that match the expectations documented in Task 3.1.  
- [ ] A regression (e.g. music detection dropping to ~0 for the music-heavy video) is easy to spot from the output.

---

## Phase 4: Wiring, Flags & Documentation

> Goal: Make it clear when the new multimodal + explanatory path is active, and avoid confusing users while you iterate.

### Task 4.1: Feature Flag Behaviour & Fallbacks

**Context**

- We now have two layers of configuration:
  - `ANALYSIS_MODE = mock | gemini` (whether we call Gemini at all).  
  - `ENABLE_ANALYSIS_V2_MULTIMODAL` (whether the new multimodal path is used instead of the text-only one).  
- `src/lib/analysis/service.ts` still uses `getTranscriptAndScenes` + per-domain text-only calls.

**Goals**

- [ ] Update `analyzeVideo` to:
  - [ ] Use the **multimodal analyzer + fingerprint builder** when:
    - `ANALYSIS_MODE = gemini` **and** `ENABLE_ANALYSIS_V2_MULTIMODAL = true`.  
  - [ ] Fall back to the existing text-based Gemini path when:
    - `ANALYSIS_MODE = gemini` but the v2 flag is false, or  
    - The multimodal client returns `FEATURE_DISABLED` / `FALLBACK_FAILED`.  
  - [ ] Continue to use `mockAnalyzeVideo` when `ANALYSIS_MODE = mock`.  
- [ ] Surface in `diagnostics` whether v2 was used:
  - E.g. `diagnostics.source = 'gemini-v2-multimodal' | 'gemini-v1-text' | 'mock'`.

**Acceptance Criteria**

- [ ] With v2 flag on, analysis for a test URL uses the multimodal path (verified via logs or debug view).  
- [ ] With v2 flag off, behaviour is unchanged from existing Gemini mode.  
- [ ] `/api/analyze` response includes a clear `diagnostics.source` value.

---

### Task 4.2: README & Docs – “What the Axes Mean”

**Context**

- Creators will only trust the tool if they can see **how** it judges them.  
- We now have axis metadata and richer domain explanations.

**Goals**

- [ ] Add a short section to `README.md` (or a new `docs/axes_and_domains.md`) that explains:
  - [ ] Meta axes (voice intensity, conceptual depth, narrative structure strength, visual dynamism, production polish) and how to interpret high vs low.  
  - [ ] Example per-domain axes (e.g., “Speech pace”, “Cut rate”, “Music coverage”) with 1–2 lines each.  
  - [ ] A note that:
    - Scores are comparative / approximate, not clinical measurements.  
    - Some metrics may be marked “unobserved” if the model cannot reliably see them.  
- [ ] Cross-link this doc from the UI (e.g. a “What do these axes mean?” link on the Overview).

**Acceptance Criteria**

- [ ] A new/newly updated doc exists explaining axes in plain language.  
- [ ] The Overview screen contains a link or hint pointing to that explanation.  
- [ ] A new contributor can answer “What does a high cut pace score mean?” by reading the docs without digging through code.

---

## Phase Transition Checklist (Iteration 2 – UX & Trust)

Use this to decide when Iteration 2 of the **upgrade track** is done and you’re ready to plan Iteration 3 (deeper archetypes, performance overlays, or scaling).

### ✅ Phase 0 – Reality Check
- [ ] URL ingestion behaviour is documented with real observations.  
- [ ] PRD/plan confirms no download/upload fallback is used.

### ✅ Phase 1 – Metric Semantics
- [ ] `axisMetadata.ts` is the single source of truth for axis labels and descriptions.  
- [ ] Multimodal metrics map cleanly to domain scores and axis details.

### ✅ Phase 2 – Domain UX
- [ ] Domain radars have proper labels and hover explanations; no placeholder axes.  
- [ ] Each domain tab includes per-axis explanatory text and a short domain summary.

### ✅ Phase 3 – Quality & Trust
- [ ] Golden video set documented with expected qualitative outcomes.  
- [ ] A simple evaluation script can be run to spot regressions in story/music/editing detection.

### ✅ Phase 4 – Wiring & Docs
- [ ] `analyzeVideo` clearly chooses between mock, text-only, and multimodal modes with diagnostics.  
- [ ] Axes and domains are documented for humans, and the UI links to that explanation.

When all of the above are ticked, creators should no longer experience:

- “It doesn’t seem to understand my video at all.”  
- “I only see bars, shapes, and tags.”  
- “I don’t know what any of these axes mean or how they’re computed.”

Instead, they should feel like the app is **watching with them**, then explaining what it saw in a way they can verify and use.
