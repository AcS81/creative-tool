# CreatorSight – Iteration 2 Implementation Tasks (Gemini-Powered MVP Slice)

## Document Information
- **Product**: CreatorSight  
- **Iteration**: 2 – Gemini-Powered MVP Slice (“Mock → Real Analysis”)  
- **Version**: 1.0  
- **Status**: Ready for AI-Driven Implementation  
- **Target Outcome**: A locally runnable app where:
  - A user pastes a YouTube URL.  
  - The system calls **real Gemini** + **YouTube Data API** to:
    - Fetch metadata + transcript/segments.  
    - Produce structured domain analyses (voice, language, narrative, visual, editing, sound).  
  - A real **fingerprint** is stored and visualized in Overview + domain tabs.  
  - The **mock pipeline** remains available behind a flag for offline/dev use.  

> Iteration 2 = “real analysis for a single video” (no YouTube Analytics performance overlay yet, no channel-level aggregation).

---

## High-level Scope for Iteration 2

From the PRD, this iteration focuses on these pieces:

- Implement **real external analysis** for a single video:
  - YouTube Data API for **metadata** (FR-2).  
  - Gemini multimodal for transcript + domain-specific qualitative analysis (FR-5–FR-11).  
- Extend the **fingerprint schema** and storage so it can hold real domain outputs & supporting data.  
- Upgrade **Overview + domain views** to show real Gemini-driven content (not just deterministic mock values).  
- Keep:
  - Reference library + similarity as in Iteration 1 (but powered by updated fingerprints).  
  - OAuth + Analytics overlay (FR-12–FR-13) and queue-based scaling for a later iteration.

Stack and tooling remain:

- Next.js App Router (TypeScript, Tailwind).  
- Prisma + SQLite.  
- Recharts for radar charts.  
- Vitest for tests.  

New configuration:

- Gemini client (e.g. `@google/generative-ai` or HTTP wrapper).  
- YouTube Data API client (or thin fetch wrapper).  
- Env flags:
  - `GEMINI_API_KEY`, `YOUTUBE_API_KEY`.  
  - `ANALYSIS_MODE=mock | gemini` (default `mock`).  

---

## Phase 0: External Services & Configuration

### Task 0.1: Env & Config for Gemini + YouTube

**Context**

- PRD Sections: 5.3 (Gemini-based analysis), 5.1–5.2 (Input & Video Handling), 6 (Non-functional).

**Goals**

- [x] Add env wiring for:
  - `GEMINI_API_KEY`  
  - `YOUTUBE_API_KEY`  
  - `ANALYSIS_MODE` (default `mock`).  
- [x] Create `src/lib/config.ts` to:
  - Read env vars.  
  - Assert required keys when `ANALYSIS_MODE === 'gemini'`.  
  - Expose a typed config object consumed by analysis services and API routes.  

**Constraints**

- App must still boot in **mock mode** if keys are missing.  
- In `gemini` mode with missing keys, analysis requests should fail fast with a clear error.

**Acceptance Criteria**

- [x] App runs with `ANALYSIS_MODE=mock` even if API keys are absent.  
- [x] If `ANALYSIS_MODE=gemini` and a required key is missing:
  - Server logs a clear error.  
  - `/api/analyze` returns a 500 with `{ error: 'MisconfiguredEnvironment', message: '...' }`.  
- [x] `.env.example` updated with `GEMINI_API_KEY`, `YOUTUBE_API_KEY`, `ANALYSIS_MODE`.  
- [x] README updated with a short explanation of mock vs Gemini modes.

---

### Task 0.2: YouTube Data API Wrapper (FR-2)

**Context**

- PRD Section 5.2: Video metadata retrieval (title, description, duration, channel, publish date).

**Goals**

- [x] Implement `src/lib/youtube/api.ts` with:
  - `fetchYoutubeMetadata(videoId: string)` → returns:
    - `title`  
    - `description`  
    - `channelTitle`  
    - `publishedAt`  
    - `durationSeconds`  
- [x] Use YouTube Data API v3 `videos.list` (or equivalent) under the hood.  
- [x] Normalize errors (invalid ID, quota exceeded, not found, etc.) into a typed error object.

**Constraints**

- No direct usage of this wrapper from UI; only from the analysis pipeline / API.  
- Avoid tight coupling to `googleapis` client; keep wrapper thin and swappable.

**Acceptance Criteria**

- [x] Valid `videoId` → metadata object with required fields.  
- [x] Non-existent or private video → error with `type: 'NotFound' | 'Forbidden'`.  
- [x] Quota or other API failure → `type: 'UpstreamError'`.  
- [x] Unit tests (with HTTP mocking) cover success + error paths.  
- [x] Analysis service uses this wrapper (no duplicate HTTP logic).

---

## Phase 1: Fingerprint & Data Shape Extensions

### Task 1.1: Extend Fingerprint Schema for Real Domains (FR-5–FR-11)

**Context**

- PRD Sections: 1.3 (Solution), 5.5 (Fingerprint & Similarity).  
- Iteration 1 already defined meta axes and simple per-domain summaries.  
- Iteration 2 needs richer, Gemini-driven structure.

**Goals**

- [x] In `src/lib/types/` and `src/lib/schemas/fingerprint.ts`, extend `VideoFingerprint` to include:
  - **Meta axes** (Overview radar) – already present:
    - `voiceIntensity`  
    - `conceptualDepth`  
    - `narrativeStructureStrength`  
    - `visualDynamism`  
    - `productionPolish`  
  - **Per-domain profiles**:
    - `voiceProfile`, `languageProfile`, `narrativeProfile`, `visualProfile`, `editingProfile`, `soundProfile`.  
    - Each domain should include:
      - `scores`: key 0–100 scores per domain axis.  
      - `primaryArchetype`, `secondaryArchetype?`.  
      - `summaryText`: short narrative description (1–2 paragraphs).  
  - **Supporting data** (optional but recommended):
    - `supporting.transcriptSegments`: `{ startSeconds, endSeconds, text }[]` (FR-5).  
    - `supporting.sceneSegments`: `{ startSeconds, endSeconds, label, shortSummary }[]`.  
    - `supporting.beats`: `{ startSeconds, endSeconds, label, devices: string[] }[]` (FR-8).  
- [x] Ensure schema remains JSON-friendly and compact.

**Constraints**

- Existing Iteration 1 fingerprints should either:
  - Still validate (if new fields are optional), or  
  - Fail with a clear `version` error if you decide to bump the schema version.  
- `version` field must be updated and enforced (e.g. `"1.1.0"`).

**Acceptance Criteria**

- [x] TypeScript types compile and match Zod schemas.  
- [x] New tests:
  - Valid fingerprint (with new domain fields) passes.  
  - Old-style fingerprint behavior is understood and documented (either still passes or fails with a descriptive `version`-related message).  
- [x] `version` is mandatory and checked in `validateFingerprint`.

---

### Task 1.2: Update Seeded Reference Fingerprints

**Context**

- PRD Section 5.5 (Reference library & similarity), 1.3 (Solution step 3).  
- Iteration 1 already seeds a small reference set with fingerprints.

**Goals**

- [x] Update `prisma/seed.ts` so reference creators’ fingerprints conform to the new schema:
  - For each reference:
    - Populate `metaAxes` coherently.  
    - Populate each domain’s `scores` and `primaryArchetype`.  
    - Add short `summaryText` per domain (hand-authored).  
- [ ] Optionally standardize a small archetype vocabulary:
  - E.g., “Reflective Analyst”, “Hyperactive Commentator”, “Calm Essayist”, “Dynamic Storyteller”.

**Constraints**

- No real personal data required; archetype-like placeholders are fine.  
- Seed script should remain idempotent or safe to re-run.

**Acceptance Criteria**

- [ ] `npm run seed` completes without errors.  
- [ ] Seeded fingerprints pass `validateFingerprint`.  
- [ ] Nearest-neighbor code from Iteration 1 still works with updated fingerprints.

---

## Phase 2: Gemini-Based Analysis Pipeline

### Task 2.1: Gemini Client & Transcript/Segmentation (FR-5)

**Context**

- PRD FR-5: Transcript & segmentation via Gemini video understanding.  
- This is the base feeding all domain analyses.

**Goals**

- [x] Implement `src/lib/gemini/client.ts` with:
  - `getTranscriptAndScenes(input: { videoUrl: string })` →  
    `{ transcriptSegments, sceneSegments }` where:
      - `transcriptSegments`: `{ startSeconds, endSeconds, text }[]`  
      - `sceneSegments`: `{ startSeconds, endSeconds, label, shortSummary }[]`  
- [x] Use a structured JSON-only prompt that:
  - Describes the required shapes.  
  - Encourages coarse segmentation for longer videos.  

**Constraints**

- No UI components call Gemini directly; always go through this wrapper.  
- Handle timeouts/partial failures gracefully (clear errors back to pipeline).

**Acceptance Criteria**

- [x] With `ANALYSIS_MODE=gemini` and valid key:
  - Sample public YouTube URL returns structured transcript + scenes.  
- [x] Gemini errors (quota, network, malformed response) are normalized to typed errors.  
- [x] Unit/integration tests with mocked Gemini responses validate shape and error paths.

---

### Task 2.2: Domain Analysis Functions (FR-6–FR-11)

**Context**

- PRD FR-6–FR-11: per-domain analysis across voice, language, narrative, visual, editing, sound.

**Goals**

- [x] Implement `src/lib/analysis/geminiDomains.ts` with functions:
  - `analyzeVoice(input): VoiceProfile` (FR-6)  
  - `analyzeLanguage(input): LanguageProfile` (FR-7)  
  - `analyzeNarrative(input): NarrativeProfile` (FR-8)  
  - `analyzeVisual(input): VisualProfile` (FR-9)  
  - `analyzeEditing(input): EditingProfile` (FR-10)  
  - `analyzeSound(input): SoundProfile` (FR-11)  
- [x] Each function:
  - Accepts transcript + scenes (and optionally video URL).  
  - Sends a single Gemini prompt that:
    - Explains the domain.  
    - Asks for JSON only, matching the fingerprint domain schema.  
  - Validates the response via Zod before returning.

**Constraints**

- Prefer one Gemini call per domain (6 calls total), acceptable for MVP.  
- No randomization; outputs should be deterministic given the same input.

**Acceptance Criteria**

- [x] All domain functions:
  - Use the shared Gemini client.  
  - Return objects that match `VideoFingerprint` domain types.  
  - Throw descriptive errors on malformed responses.  
- [x] Tests:
  - Mocked Gemini responses validate successfully.  
  - Deliberately malformed JSON fails with clear validation errors.

---

### Task 2.3: Integrate Gemini into `analyzeVideo` Service

**Context**

- PRD Section 7 (Pipelines), 5.5 (Fingerprint construction).  
- Iteration 1’s `mockAnalyzeVideo` and `analyzeVideo` already define the interface.

**Goals**

- [ ] In `src/lib/analysis/service.ts`, extend `analyzeVideo(input, options)` to support:
  - `ANALYSIS_MODE=mock`: current behavior (Iteration 1).  
  - `ANALYSIS_MODE=gemini`: new behavior:
    1. Call `getTranscriptAndScenes`.  
    2. Call each domain analysis function.  
    3. Aggregate into a full `VideoFingerprint`.  
    4. Compute meta axes from domain scores (or accept them directly if domain functions supply them).  
    5. Derive an overall archetype name from meta axes (similar to mock, but now based on real outputs).  
- [ ] Keep function’s external `AnalyzeVideoResult` shape stable:
  - `{ fingerprint, overallArchetype, diagnostics }`.

**Constraints**

- Gemini mode may take minutes; keep the endpoint synchronous for this iteration but ensure timeouts are reasonable.  
- No background jobs yet; async worker model is a later iteration.

**Acceptance Criteria**

- [ ] `ANALYSIS_MODE=mock` -> unchanged behavior from Iteration 1.  
- [ ] `ANALYSIS_MODE=gemini`:
  - For a sample video, returns a valid `VideoFingerprint` + archetype.  
  - `validateFingerprint` passes.  
- [ ] At least one integration-style test (with mocked Gemini + YouTube API) runs the full pipeline and asserts:
  - Meta axes are within 0–100.  
  - Domain profiles populated.  
  - Archetype string present.

---

## Phase 3: API & Persistence Integration

### Task 3.1: Update `/api/analyze` to Use Gemini Mode (FR-5, FR-14–FR-15)

**Context**

- PRD Sections: 5.1 (Input & Video Handling), 5.4–5.5 (Performance integration later, fingerprint now), 7 (Pipelines).  
- Iteration 1 already wires URL intake, mock pipeline, and DB persistence.

**Goals**

- [ ] Keep POST `/api/analyze` contract:
  - Input: `{ url: string, creatorDisplayName?: string }`.  
  - Output: `{ videoAnalysisId, fingerprint, overallArchetype, nearestReferences }`.  
- [ ] On valid URL:
  - Use `parseYouTubeUrl` to extract `videoId`.  
  - Use `fetchYoutubeMetadata(videoId)` to populate `VideoAnalysis` fields:
    - `title`, `durationSeconds`, `channelId` (if available), `status`.  
  - Call `analyzeVideo` with mock or Gemini pipeline depending on `ANALYSIS_MODE`.  
  - Store the `VideoFingerprint` row as before.  
  - Compute nearest reference creators based on updated fingerprints.  
- [ ] On errors from Gemini/YouTube:
  - Mark `VideoAnalysis.status = 'failed'`.  
  - Add `failureReason` field describing the issue.

**Constraints**

- Still synchronous for now; no queue or polling.  
- Proper HTTP status codes:
  - `400` for invalid URL.  
  - `500` for analysis or upstream errors.

**Acceptance Criteria**

- [ ] POST `/api/analyze` with valid URL:
  - Returns 200 with expected response shape.  
  - Creates/updates `CreatorProfile`, `VideoAnalysis`, `VideoFingerprint` rows.  
- [ ] On Gemini/YouTube failure:
  - Returns 500 with `{ error: 'AnalysisFailed', message }`.  
  - `VideoAnalysis` row exists with `status = 'failed'` and `failureReason` set.  
- [ ] Repeated analyses for the same URL create new `VideoAnalysis` history rows (unchanged from Iteration 1).

---

### Task 3.2: Similarity Engine Uses Real Fingerprints (FR-15)

**Context**

- PRD FR-15: Reference library & similarity.  
- Iteration 1 likely uses meta axes for simple Euclidean distance.

**Goals**

- [ ] Refine similarity computation to work with updated fingerprints:
  - Keep Euclidean distance on normalized meta axes as the primary metric.  
  - Optionally add small weights from domain-level scores (e.g., voice intensity differences).  
- [ ] Ensure implementation is shared between mock and Gemini modes.

**Acceptance Criteria**

- [ ] For a set of example fingerprints:
  - Similarity function returns deterministic distances.  
  - Fingerprints “close” in meta axes produce smaller distances.  
- [ ] Nearest-reference logic still returns at least one reference creator for every valid user fingerprint.

---

## Phase 4: UI – Real Data in Overview & Domain Tabs

### Task 4.1: Overview Screen – Video Metadata + Real Archetype (FR-16)

**Context**

- PRD Section 4.1 (Overview Screen) and 5.2 (Video metadata).

**Goals**

- [ ] On successful analysis, show basic YouTube metadata on the Overview:
  - Title  
  - Channel name  
  - Publish date  
  - Duration  
- [ ] Use the real `overallArchetype` from the Gemini-powered pipeline.  
- [ ] Keep the existing radar chart but ensure it uses the updated meta axes.

**Constraints**

- If metadata lookup fails but analysis succeeds, show a graceful placeholder for metadata while still rendering everything else.

**Acceptance Criteria**

- [ ] After an analysis in Gemini mode:
  - Overview shows metadata + radar chart + archetype.  
- [ ] In mock mode, Overview behavior remains as in Iteration 1 (metadata may be stubbed or omitted).

---

### Task 4.2: Domain Tabs – Real Content & Simple Visuals (FR-17)

**Context**

- PRD Section 4.2–4.3 and 5.3 (domain visualizations).

**Goals**

- [ ] For each domain tab (Voice, Language, Narrative, Visual, Editing, Sound):
  - Display:
    - Domain archetype name (`primaryArchetype`).  
    - Domain `summaryText` from fingerprint.  
    - A simple visual for domain scores.  
- [ ] Suggested visuals:
  - Voice: pentagram or bars for `energy`, `expressiveness`, `clarity`, `warmth`, `flow`.  
  - Language: bars for story vs explanation vs instruction vs humor ratio.  
  - Narrative: simple timeline of key beats (hook, setup, payoff, etc.).  
  - Visual: badges for environment stability, movement, facial expressiveness.  
  - Editing: cut pace indicator + B-roll presence.  
  - Sound: bars for music coverage %, music loudness vs voice, SFX usage.

**Constraints**

- Handle missing domain data gracefully (e.g., show “partial analysis” instead of crashing).  
- Keep visuals responsive and aligned with existing Tailwind style.

**Acceptance Criteria**

- [ ] For a completed analysis in Gemini mode:
  - Each domain tab shows non-empty, domain-specific content derived from fingerprint.  
- [ ] If a domain is missing, a clear “partial analysis” message appears and the rest of the UI remains functional.

---

### Task 4.3: “Where You’re Unusual” Powered by Real Reference Set (FR-16)

**Context**

- PRD Section 4.1 (“Where you’re unusual vs typical”).

**Goals**

- [ ] Reuse or refine `src/lib/analysis/insights.ts` to compute “Where you’re unusual” bullets using:
  - User meta axes.  
  - Seeded reference meta axes from updated fingerprints.  
- [ ] Generate 2–4 concise insights highlighting stats like:
  - “More abstract than 80% of reference creators.”  
  - “Higher visual dynamism than typical for this archetype.”

**Acceptance Criteria**

- [ ] At least 2–4 bullet points show up for typical analyses.  
- [ ] Text uses actual axes and is human-readable.  
- [ ] Behavior is consistent between mock and Gemini modes (logic is the same; only underlying data differs).

---

## Phase 5: Dev Experience & E2E

### Task 5.1: README & Env Updates for Gemini Mode

**Context**

- PRD Section 6 (Non-functional requirements), plus Iteration 1 README baseline.

**Goals**

- [ ] Extend `README.md` to explain:
  - How to run in `mock` mode (Iteration 1 behavior).  
  - How to enable `gemini` mode:
    - Set `GEMINI_API_KEY`, `YOUTUBE_API_KEY`, `ANALYSIS_MODE=gemini`.  
  - Latency and cost expectations (e.g., up to 5–10 minutes, per-clip cost notes).  
- [ ] Clarify privacy:
  - No raw video stored; only URLs and derived fingerprints.

**Acceptance Criteria**

- [ ] Fresh developer can follow README to:
  - Run the app in `mock` mode.  
  - Switch to `gemini` mode (if they have keys) and successfully analyze at least one public video.

---

### Task 5.2: Minimal E2E Check (Mock + Gemini Modes)

**Context**

- PRD Section 3.2 (Core use cases), 6 (Reliability).  
- Iteration 1 already defined a happy-path E2E check.

**Goals**

- [ ] Add `docs/iteration_2_e2e.md` (or update existing E2E doc) to describe:
  - E2E flow in **mock mode** (unchanged from Iteration 1).  
  - E2E flow in **gemini mode**:
    1. Configure env with real keys and `ANALYSIS_MODE=gemini`.  
    2. Run migrations/seeds if needed.  
    3. Start dev server.  
    4. Paste a YouTube URL and run analysis.  
    5. Verify Overview + domain tabs show real Gemini-driven content.  
- [ ] Optionally add or update an automated API-level test that:
  - Mocks Gemini + YouTube.  
  - Hits `/api/analyze`.  
  - Asserts that response contains filled meta axes and domain data.

**Acceptance Criteria**

- [ ] Manual E2E run in both modes succeeds on your machine.  
- [ ] All existing tests still pass; new tests for Gemini pipeline (with mocks) are green.

---

## Phase Transition Checklist (Iteration 2)

Use this checklist to confirm **Iteration 2** is complete before planning Iteration 3.

### ✅ Phase 0 – External Services & Config

- [x] Env vars and config for Gemini + YouTube set up.  
- [x] YouTube Data API wrapper works for metadata.  

### ✅ Phase 1 – Fingerprint & Data Shape

- [x] Fingerprint schema extended with real domain structures and supporting data.  
- [ ] Seeded reference fingerprints updated to new schema.  

### ✅ Phase 2 – Gemini Pipeline

- [ ] Gemini client returns transcript and scenes.  
- [ ] Domain analysis functions produce valid domain profiles.  
- [ ] `analyzeVideo` supports both mock and Gemini modes.  

### ✅ Phase 3 – API & Persistence

- [ ] `/api/analyze` uses YouTube metadata and Gemini pipeline when enabled.  
- [ ] VideoAnalysis rows track `pending` / `complete` / `failed` with reasons.  
- [ ] Similarity engine runs against updated fingerprints.  

### ✅ Phase 4 – UI

- [ ] Overview shows video metadata, archetype, radar, neighbours, and “Where you’re unusual” from real data.  
- [ ] Domain tabs display archetypes, summaries, and visuals for all domains.  

### ✅ Phase 5 – Dev & E2E

- [ ] README explains mock vs Gemini modes and setup.  
- [ ] E2E flows verified in both modes on a fresh environment.  

---

## Summary

- **Iteration 1 Objective** (already done): Local mock MVP where:
  - You paste a YouTube URL.  
  - A mock analysis pipeline runs.  
  - Results are stored and visualized with Overview + domain skeletons.  

- **Iteration 2 Objective**: Upgrade to a **Gemini-powered MVP slice** where:
  - The same flow runs on real Gemini + YouTube Data API.  
  - Fingerprints carry rich domain structures.  
  - Overview and domain tabs show real, qualitative insight aligned with the PRD.  
  - Mock mode remains available for local/dev and offline work.
