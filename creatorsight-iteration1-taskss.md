# CreatorSight – Iteration 1 Implementation Tasks (Foundational Local MVP)

## Document Information
- **Product**: CreatorSight  
- **Iteration**: 1 (Foundational Local MVP – “URL → Mock Analysis → Visual Fingerprint”)  
- **Version**: 1.0  
- **Status**: Ready for AI-Driven Implementation  
- **Target Outcome**: A **locally runnable** project where a user can paste a YouTube URL, trigger an analysis pipeline (mocked, no real Gemini yet), and see an **Overview screen** with:
  - Overall archetype card  
  - A meta-level radar chart  
  - Basic “closest neighbours” from a small local reference library  

> This iteration is the foundational slice. Later iterations will swap in real Gemini analysis, YouTube Analytics, richer domain UIs, and channel-level profiles.

---

## High-level Scope for Iteration 1

From the PRD, this iteration focuses on **foundational capabilities** only:

- Single platform: **YouTube URL input only**.  
- No real Gemini yet: analysis is **mock/simulated**, but:
  - The **data structures, APIs, and UI** are designed as if real Gemini-based analysis is already wired.  
- No YouTube Analytics / OAuth yet.  
- No full per-domain deep dives yet (Voice/Narrative/etc. views are skeletons).  
- No PDF export, multi-video aggregation, or advanced coaching.

**Iteration 1 = Foundation + “Happy Path” vertical slice:**

> Paste URL → Validate → Create/lookup CreatorProfile → Run mock pipeline → Create VideoAnalysis + Fingerprint → Render Overview screen (with radar chart + archetype card + simple “closest neighbours”).

Later iterations can plug in **real Gemini**, **YouTube Analytics**, **richer domain views**, and **reference library scale-up** with minimal refactors.

---

## Technical Baseline (for this iteration)

To keep everything **locally runnable** and simple:

- **Frontend / Backend**: Next.js 14+ with App Router (single app)  
- **Language**: TypeScript  
- **Styling**: Tailwind CSS  
- **DB**: SQLite via Prisma (file-based, easy local dev)  
- **Charts**: `recharts` for radar charts  
- **AI & YouTube**: **Mock services only** in this iteration (environment flags to swap later)  

You can change this stack later; tasks are structured so that Gemini/YouTube integrations swap in behind interfaces.

---

## Phase 0: Foundation

### Task 0.1: Project Infrastructure Setup

**Context**

- Based on PRD Sections: 1 (Product Overview), 2.1 (Scope), 7 (Data & Architecture).
- Goal: Clean, opinionated base project suitable for iterative AI-driven development.

**Goals**

- [x] Initialize a Next.js 14+ project with App Router (`app/` dir) and TypeScript (`strict`).  
- [x] Add Tailwind CSS and basic design tokens (colors, typography scale).  
- [x] Add Prisma with SQLite:
  - Initial `schema.prisma` with empty `CreatorProfile`, `VideoAnalysis`, `VideoFingerprint` model placeholders (no fields yet).  
- [x] Add basic top-level pages:
  - `/` – Landing stub: “CreatorSight – paste a YouTube URL to get a creative fingerprint (coming soon).”  
- [x] Add basic tooling:
  - ESLint + Prettier  
  - `package.json` scripts: `dev`, `build`, `start`, `lint`, `prisma:migrate`, `prisma:studio`.  
- [x] Create `.env.example` (no secrets yet, just placeholders).  

**Constraints**

- Single repo (monolith) with both API and UI via Next.js.  
- Must run using `npm run dev` and only local SQLite DB.

**Acceptance Criteria**

- [x] `npm install` and `npm run dev` starts app on `localhost:3000` without errors.  
- [x] Visiting `/` shows a simple CreatorSight landing message.  
- [x] Tailwind is active (e.g., `className="text-2xl font-bold"` works).  
- [x] `npx prisma migrate dev --name init` runs successfully.  
- [x] `.env.example` exists and `.env` is **gitignored**.

**Manual Test**

1. Clone repo, run `npm install`.  
2. Run `npm run dev` → open `http://localhost:3000`.  
3. Confirm landing text and basic styling.  
4. Run `npx prisma migrate dev` → no errors.  
5. Run `npm run lint` → passes.

**Task Complete When**

- [x] All acceptance criteria met.  
- [x] Code committed (excluding `.env`).  
- [x] Short “Getting started” section in `README.md` added.

---

### Task 0.2: Core Domain Types & Fingerprint Schema

**Context**

- PRD Sections: 1.3 (Solution), 5.5 (Fingerprint & Similarity), 7 (Data & Architecture).  
- We want a **canonical JSON fingerprint** across domains that everything else reads from.

**Goals**

- [ ] Define TypeScript types in `src/lib/types/` for:
  - `CreatorType = 'user' | 'reference'`  
  - `CreatorProfile`  
  - `VideoAnalysis`  
  - `VideoFingerprint`  
- [ ] Define a JSON-friendly **fingerprint schema** that aligns with PRD domains:
  - Meta axes (Overview radar):
    - `voiceIntensity`, `conceptualDepth`, `narrativeStructureStrength`, `visualDynamism`, `productionPolish`.  
  - Per-domain summaries:
    - `voiceProfile`, `languageProfile`, `narrativeProfile`, `visualProfile`, `editingProfile`, `soundProfile`.  
- [ ] Add Zod schemas for fingerprint validation in `src/lib/schemas/fingerprint.ts`.  
- [ ] Export helper functions:
  - `validateFingerprint(json)` → throws with helpful error on invalid.  
  - `isValidFingerprint(json)` → boolean.  

**Constraints**

- The schema should be **compact** and stable; later Gemini outputs must fit into this shape.  
- Required:
  - `version`, `createdAt`, `metaAxes`, `perDomain`.  
- Domain profiles can start simple (e.g., 0–100 scores + strings) but should anticipate radar charts and archetype names.

**Acceptance Criteria**

- [ ] TypeScript interfaces compile without errors.  
- [ ] Zod schemas match interfaces exactly.  
- [ ] At least one unit test file (e.g., `fingerprint.test.ts`) with:
  - Valid fingerprint passes.  
  - Missing required field fails with descriptive error.  
- [ ] `version` field enforced (e.g., `"1.0.0"`).  

**Manual Test**

1. Create a sample fingerprint JSON in a test file.  
2. Run `validateFingerprint(sample)` → passes.  
3. Remove `metaAxes` → `validateFingerprint` throws clear error.  
4. Use types in a React component → IntelliSense shows fields correctly.

**Task Complete When**

- [ ] Types + schemas + tests committed.  
- [ ] No TypeScript or linting errors.

---

## Phase 1: Data Layer & Persistence

### Task 1.1: Prisma Models & Migrations

**Context**

- PRD Section 7 (Data & Architecture): Entities – CreatorProfile, VideoAnalysis, VideoFingerprint.  
- We want a minimal schema that supports:
  - Creator profiles  
  - Video analyses  
  - Fingerprints as JSON  

**Goals**

- [x] Update `schema.prisma` with:
  - `CreatorProfile`:
    - `id` (string, uuid)  
    - `type` (`user` | `reference`)  
    - `displayName`  
    - `channelId` (nullable string)  
    - `createdAt`, `updatedAt`  
  - `VideoAnalysis`:
    - `id` (uuid)  
    - `creatorId` (FK → CreatorProfile)  
    - `youtubeVideoId`  
    - `title`  
    - `durationSeconds`  
    - `status` (`pending` | `complete` | `failed`)  
    - `createdAt`, `updatedAt`  
  - `VideoFingerprint`:
    - `id` (uuid)  
    - `videoAnalysisId` (FK → VideoAnalysis, 1:1)  
    - `fingerprint` (JSON stored as text for SQLite)  
    - `createdAt`  
- [x] Run Prisma migrate.  
- [x] Add `src/lib/db.ts` with a singleton Prisma client.

**Constraints**

- Use SQLite for this iteration.  
- Use cascading deletes (if a `VideoAnalysis` is deleted, `VideoFingerprint` goes too).  
- Don’t over-design; no analytics/performance tables yet.

**Acceptance Criteria**

- [x] Prisma schema validates (`npx prisma validate` passes).  
- [x] `npx prisma migrate dev --name init_core_models` succeeds.  
- [ ] `npx prisma studio` shows all three tables.  
- [ ] Foreign keys set and working.

**Manual Test**

1. Open Prisma Studio → create a `CreatorProfile` manually.  
2. Create a `VideoAnalysis` linked to that profile.  
3. Create a corresponding `VideoFingerprint` with a sample JSON.  
4. Delete `VideoAnalysis` → `VideoFingerprint` is removed (if using cascade).  

**Task Complete When**

- [ ] All acceptance criteria met.  
- [x] `db.ts` helper committed and used in at least one small script or test.

---

### Task 1.2: Seed Script for Reference Creators

**Context**

- PRD Section 5.5 (Reference library & similarity), 1.3 (Solution step 3).  
- For this iteration, we use a **small, hardcoded reference set** (e.g., 3–5 famous YouTubers) with manually created fingerprints.

**Goals**

- [ ] Create `prisma/seed.ts` that:
  - Creates a few `CreatorProfile` entries with `type = 'reference'`.  
  - Attaches one `VideoAnalysis` + `VideoFingerprint` per reference creator with **hand-authored** fingerprints (aligned with schema).  
- [ ] Add npm script `npm run seed` to execute the seed with `ts-node` or a compiled version.  
- [ ] Document how to run seeds in `README`.

**Constraints**

- No external API calls during seeding; all data is mocked.  
- Fingerprints must be **valid** per Zod schema from Task 0.2.  
- Use recognizable placeholder names (“High-Energy Commentator”, “Calm Storyteller”) without real personal data if you prefer.

**Acceptance Criteria**

- [ ] Running `npm run seed` populates DB with:
  - At least 3 `CreatorProfile` rows of type `reference`.  
  - Each with one `VideoAnalysis` and one `VideoFingerprint`.  
- [ ] No seed errors if run multiple times (idempotent or safe to re-run).  
- [ ] Seeded fingerprints pass `validateFingerprint`.

**Manual Test**

1. Run `npm run seed`.  
2. Open Prisma Studio → confirm profiles & fingerprints exist.  
3. Optionally write a tiny Node script using Prisma to fetch references and log fingerprints.

**Task Complete When**

- [ ] Seed script and documentation committed.  
- [ ] Validation of seeded fingerprints confirmed.

---

## Phase 2: YouTube URL Intake & Mock Analysis Pipeline

### Task 2.1: YouTube URL Parsing & Validation

**Context**

- PRD Section 5.1 (Input & Video Handling, FR-1), 5.2 (Video metadata).  
- Iteration 1: we only need **URL validation and ID extraction**, not actual YouTube API calls.

**Goals**

- [ ] Implement `parseYouTubeUrl(url: string)` in `src/lib/youtube.ts` to:
  - Accept full YouTube URLs (`watch?v=…`, `youtu.be/...`, etc.).  
  - Extract the canonical `videoId`.  
  - Reject non-YouTube URLs.  
- [ ] Add a small utility `isValidYouTubeUrl(url: string)` for client-side checks.  
- [ ] Add unit tests for edge cases.

**Constraints**

- No network calls.  
- Handle common URL variants, including with query params (`&t=30s` etc.).

**Acceptance Criteria**

- [ ] Valid YouTube URLs return a non-empty `videoId`.  
- [ ] Non-YouTube URLs (or malformed ones) return an error or `null`.  
- [ ] Unit tests cover at least:
  - `https://www.youtube.com/watch?v=abc123`  
  - `https://youtu.be/abc123`  
  - URLs with timestamps and extra params.  
  - Non-YouTube domain.  

**Manual Test**

1. Run unit tests.  
2. In a temporary page or script, paste some YouTube URLs and log extracted IDs.

**Task Complete When**

- [ ] YouTube utilities ready and tested.  
- [ ] Used by later tasks (e.g. analysis API).

---

### Task 2.2: Mock Analysis Service & Pipeline Interface

**Context**

- PRD Sections:
  - 5.3 (Gemini-based analysis B–G)  
  - 5.5 (Fingerprint construction)  
  - 7 (Pipelines)  
- This iteration creates a **mock pipeline** that looks like the final one externally.

**Goals**

- [ ] Define an interface in `src/lib/analysis/types.ts`:
  - `AnalyzeVideoInput` (includes `videoId`, optional metadata).  
  - `AnalyzeVideoResult` (includes `fingerprint`, high-level archetype name, diagnostic info).  
- [ ] Implement `mockAnalyzeVideo(input)` that:
  - Uses the fingerprint Zod schema to output **valid** fingerprints.  
  - Generates deterministic values from `videoId` (e.g., via a simple hash) so re-runs are stable.  
  - Assigns a plausible overall archetype name based on meta axes (e.g., high intensity + high dynamism = “Hyperactive Commentator”).  
- [ ] Wrap this in a service in `src/lib/analysis/service.ts`:
  - `analyzeVideo(input, { useMock: boolean })` → currently only `mock`, but shaped to later plug in Gemini.

**Constraints**

- No calls to Gemini or YouTube APIs yet.  
- Avoid randomness except deterministic pseudo-random from `videoId`.  
- Output must be valid fingerprint JSON.

**Acceptance Criteria**

- [ ] `mockAnalyzeVideo` returns a result within ~100ms.  
- [ ] Two calls with same `videoId` produce identical results.  
- [ ] The returned fingerprint passes `validateFingerprint`.  
- [ ] At least 3–4 distinct archetype labels possible, determined by meta axes.

**Manual Test**

1. Call `mockAnalyzeVideo({ videoId: 'abc123' })` in a Node script:
   - See fingerprint JSON.  
   - See archetype string.  
2. Change `videoId` → meta axes & archetype change predictably.  
3. Pass invalid input through the pipeline (if allowed) → see reasonable error.

**Task Complete When**

- [ ] Service & interface committed with tests.  
- [ ] This service is ready for API integration.

---

### Task 2.3: Analysis API Endpoint & DB Integration

**Context**

- PRD Sections: 5.1 (Input handling), 5.5 (Fingerprint & Similarity), 7 (Pipelines).  
- This task wires together:
  - URL intake  
  - Mock analysis service  
  - Persistence  

**Goals**

- [ ] Create POST handler at `app/api/analyze/route.ts`:
  - Accept JSON: `{ url: string, creatorDisplayName?: string }`.  
  - Validate URL (using `parseYouTubeUrl`).  
  - Resolve or create a `CreatorProfile` for this “session”:
    - For now, you can treat all users as anonymous and create a simple `CreatorProfile` per browser session or just per analysis (Iteration 2 can add real auth).  
  - Create a `VideoAnalysis` row with status `pending`.  
  - Call `analyzeVideo` (mock).  
  - Store the `VideoFingerprint` row.  
  - Update `VideoAnalysis.status = 'complete'`.  
  - Compute basic “nearest reference creators” by Euclidean distance on meta axes vs seeded reference fingerprints.  
- [ ] Return response:

  ```ts
  {
    videoAnalysisId: string;
    fingerprint: VideoFingerprintJson;
    overallArchetype: string;
    nearestReferences: Array<{ creatorId: string; displayName: string; distance: number }>;
  }
  ```

**Constraints**

- Synchronous for this iteration (no background jobs); response should finish within a second or two.  
- Proper HTTP status codes:
  - `400` for invalid URL.  
  - `500` for unexpected errors.  
- No real authentication; association to CreatorProfile can be simple (e.g., “local-anonymous” creator).

**Acceptance Criteria**

- [ ] POST `/api/analyze` with valid YouTube URL returns 200 and the shape above.  
- [ ] DB rows for `CreatorProfile`, `VideoAnalysis`, `VideoFingerprint` are created.  
- [ ] Repeated analyses with same URL create new `VideoAnalysis` rows (history).  
- [ ] Invalid URL returns 400 with `{ error: 'InvalidYouTubeUrl', message: … }`.  
- [ ] Nearest reference creators array has at least 1 element from seed data.

**Manual Test**

1. Use `curl` or Postman:
   - `POST /api/analyze` with `{ "url": "https://www.youtube.com/watch?v=abc123" }`.  
2. Check JSON response: has `videoAnalysisId`, `fingerprint`, `nearestReferences`.  
3. Check SQLite DB via Prisma Studio:
   - New CreatorProfile (if needed).  
   - New VideoAnalysis + VideoFingerprint rows.  
4. Try invalid URL → 400 with appropriate message.

**Task Complete When**

- [ ] API route wired to mock analysis and DB.  
- [ ] At least one happy-path end-to-end test (API-only) exists.

---

## Phase 3: Overview UI & Visualization

### Task 3.1: URL Input + Analysis Trigger UI (Overview Page Shell)

**Context**

- PRD Section 4.1 (Overview Screen), 3.2 (Core use case 1: Analyze my video).  
- This is the **primary UX entry point**.

**Goals**

- [ ] Implement `/app/page.tsx` or `/app/analyze/page.tsx` as the main UI:
  - A card with:
    - Input field for YouTube URL.  
    - “Analyze video” button.  
    - Basic validation (client-side using `isValidYouTubeUrl`).  
- [ ] On submit:
  - Call `POST /api/analyze`.  
  - Show loading state (“Analyzing your creative fingerprint…”).  
  - On success, store the response in local state.  
- [ ] Display a simple summary panel:
  - Overall archetype name.  
  - List of 2–3 nearest reference creators with distance.  

**Constraints**

- Keep styling simple but clean (Tailwind).  
- Must be mobile-friendly.  
- For this iteration, **no authentication**; treat as single-user local app.

**Acceptance Criteria**

- [ ] Visiting `/` shows URL input + analyze button.  
- [ ] Pasting invalid/non-YouTube URL shows inline error and no API call.  
- [ ] Valid URL triggers API call and loading UI.  
- [ ] On success, archetype + neighbours appear below the form.  
- [ ] Errors from API are shown as simple messages (“Could not analyze this URL. Please check and try again.”).

**Manual Test**

1. Start dev server, visit `/`.  
2. Enter invalid URL (e.g., `https://google.com`) → client-side error.  
3. Enter valid YouTube URL:
   - See loading state.  
   - See archetype + neighbours after response.  
4. Refresh page → previously shown results are cleared (we can add history later).

**Task Complete When**

- [ ] UI and API integrated for a working basic “Analyze my video” flow.

---

### Task 3.2: Overview Radar Chart

**Context**

- PRD Section 4.1 (Overview Screen – large radar chart with meta axes).  
- We now visualize the **meta axes** of the fingerprint.

**Goals**

- [ ] Install `recharts` (or similar) for radar chart visualization.  
- [ ] Create `RadarChartOverview` component in `src/components/RadarChartOverview.tsx`:
  - Props: meta axes from fingerprint + optional “niche-average polygon”.  
- [ ] For this iteration, compute a simple **static “niche average”** polygon (e.g., mid-values or average of reference fingerprints).  
- [ ] Integrate chart into Overview page:
  - Show when analysis result is available.  
  - Label axes:
    1. Voice intensity  
    2. Conceptual depth  
    3. Narrative structure strength  
    4. Visual dynamism  
    5. Production polish  

**Constraints**

- Must support responsive layout for mobile & desktop.  
- Radar chart should show:
  - Filled polygon for user.  
  - Faint outline polygon for niche-average.  

**Acceptance Criteria**

- [ ] Radar chart renders without errors for the sample fingerprint.  
- [ ] Axes labels match PRD meta axes exactly.  
- [ ] The component handles missing or partial data gracefully (e.g., hide chart or show message).  
- [ ] Works in mobile (chart fits available width, no overflow).

**Manual Test**

1. Run an analysis (from Task 3.1).  
2. Confirm radar chart appears with 5 labeled axes.  
3. Resize browser to narrow width (~375px) → chart still readable.  
4. Manually break fingerprint data (e.g., remove one axis in a dev test) → chart hides or shows a useful error.

**Task Complete When**

- [ ] Radar chart integrated into Overview page with real data from fingerprint.

---

### Task 3.3: “Where You’re Unusual” Summary

**Context**

- PRD Section 4.1 (Overview – “Where you’re unusual vs typical”).  
- For iteration 1 we use simple heuristics vs reference fingerprints.

**Goals**

- [ ] Implement a helper in `src/lib/analysis/insights.ts`:
  - Input: user meta axes, array of reference meta axes.  
  - Output: simple bullet list of 2–4 textual insights, e.g.:
    - “More abstract than 80% of reference creators.”  
    - “Less visually dynamic than most reference creators.”  
- [ ] Display this as a bullet list on the Overview page under the radar chart.

**Constraints**

- Heuristics can be simplistic (e.g., percentile buckets).  
- Do not overfit; this is just to shape UI & data model.

**Acceptance Criteria**

- [ ] At least 2 insights generated per analysis (when reference data exists).  
- [ ] Text is human readable and grounded in the data.  
- [ ] If no reference creators exist (e.g., seed not run), show fallback (“Not enough reference data yet.”).

**Manual Test**

1. Run `npm run seed`, then analyze a few URLs.  
2. Check the insights list; it changes when meta axes change.  
3. Temporarily clear reference data and re-run → see fallback message.

**Task Complete When**

- [ ] Insight helper and UI integration are committed and working.

---

## Phase 4: Domain Views Skeleton (Voice, Narrative, etc.)

### Task 4.1: Domain View Layout & Navigation

**Context**

- PRD Sections 4.2–4.3 (Voice View, Other domain views), 1.3 (Solution step 4).  
- Iteration 1: create **layout & navigation skeleton**, with minimal content pulled from fingerprint.

**Goals**

- [ ] Create a tabbed layout or secondary navigation on the Overview page:
  - Tabs: `Overview`, `Voice`, `Language`, `Narrative`, `Visual`, `Editing`, `Sound`.  
- [ ] For each tab (except Overview):
  - Show heading: “Your {Domain}”.  
  - Show a small text summary extracted from fingerprint (e.g., `voiceProfile.summary`).  
  - Show a simple 5-axis radar or bar chart **placeholder** for that domain (even if using mock static data for now).  
- [ ] Factor out shared layout into `src/components/Layout/AnalysisLayout.tsx`.  

**Constraints**

- Data for domain views should come from the fingerprint structure, even if currently simplistic.  
- No need for per-beat timelines etc. yet; that comes in later iterations.

**Acceptance Criteria**

- [ ] User can switch between tabs without losing analysis data in state.  
- [ ] Each domain tab shows:
  - Domain name.  
  - One short summary line.  
  - A simple visual (radar or bar chart).  
- [ ] If no analysis exists (user hasn’t run one), tabs either disabled or show a “Run an analysis first” message.

**Manual Test**

1. Run an analysis.  
2. Click each tab in turn; content updates accordingly.  
3. Refresh page (analysis lost for now) → tabs should not crash and should show graceful empty state.

**Task Complete When**

- [ ] Domain-level navigation and skeleton views present and stable.

---

## Phase 5: Local Dev Experience & Testing

### Task 5.1: Local Run Instructions & Env Management

**Context**

- PRD Section 6 (Non-functional requirements: latency, cost, scalability, privacy).  
- For iteration 1, we care mainly about **local setup & privacy around derived data**.

**Goals**

- [ ] Expand `README.md` to include:
  - Prerequisites (Node version).  
  - Setup steps (`npm install`, `prisma migrate`, `npm run seed`, `npm run dev`).  
  - Short explanation of mock analysis vs future Gemini integration.  
- [ ] Add `.env.example` with:
  - `DATABASE_URL` (for SQLite).  
  - Placeholder keys for future: `GEMINI_API_KEY`, `YOUTUBE_API_KEY` (not used yet).  
- [ ] Ensure `.env` is listed in `.gitignore`.

**Constraints**

- README should be enough for a fresh developer to get from clone → running app in <10 minutes.

**Acceptance Criteria**

- [ ] Fresh checkout on another machine (or container) can follow README and get app running.  
- [ ] No runtime errors due to missing env vars (for this iteration; Gemini keys not required yet).

**Manual Test**

1. Delete `node_modules`, `.next/`, and DB file.  
2. Follow README exactly → app runs and seed data is created.  
3. Analyze a video successfully via UI.

**Task Complete When**

- [ ] README + env setup clear and tested.

---

### Task 5.2: Minimal E2E “Happy Path” Check

**Context**

- PRD Section 3.2 (Core use cases), 6 (Reliability).  
- Verify that the **end-to-end path** works as our iteration-1 promise.

**Goals**

- [ ] Document a minimal E2E test flow in `docs/iteration_1_e2e.md`:
  1. Start dev server.  
  2. Paste YouTube URL.  
  3. Click “Analyze video”.  
  4. See archetype, radar chart, nearest neighbours, and domain tabs.  
- [ ] Optionally add a simple Playwright or Cypress test that:
  - Loads page.  
  - Fills URL.  
  - Waits for result text (e.g., archetype label).  

**Constraints**

- Keep it light; one E2E “happy path” is enough for this iteration.

**Acceptance Criteria**

- [ ] Manual E2E test steps documented and reproducible.  
- [ ] If using automated test, it passes locally via `npm run test:e2e` or similar.

**Manual Test**

1. Follow your own documented steps from a fresh browser window.  
2. Confirm visual and data elements appear as expected.

**Task Complete When**

- [ ] You can confidently say, “At the end of iteration 1, a user can locally run CreatorSight, paste a YouTube URL, and see a creative fingerprint overview with archetype, radar chart, neighbours, and domain tabs.”

---

## Phase Transition Checklist (Iteration 1)

Use this checklist to confirm **Iteration 1** is complete before planning Iteration 2.

### ✅ Phase 0 – Foundation

- [x] Next.js + TypeScript + Tailwind project runs locally.  
- [x] Prisma + SQLite configured and migrates.  

### ✅ Phase 1 – Data Layer

- [x] `CreatorProfile`, `VideoAnalysis`, `VideoFingerprint` models exist.  
- [ ] Seeded reference creators and fingerprints exist.  

### ✅ Phase 2 – Mock Pipeline

- [ ] YouTube URLs validated and parsed reliably.  
- [ ] Mock analysis service produces valid fingerprints + archetypes.  
- [ ] POST `/api/analyze` persists analyses and fingerprints.  

### ✅ Phase 3 – Overview UI

- [ ] User can paste a YouTube URL and trigger analysis from UI.  
- [ ] Overview shows archetype, radar chart, and nearest reference creators.  
- [ ] “Where you’re unusual” bullets displayed.  

### ✅ Phase 4 – Domain Skeleton Views

- [ ] Tabs for Overview, Voice, Language, Narrative, Visual, Editing, Sound.  
- [ ] Each domain tab shows summary text + simple visual.  

### ✅ Phase 5 – Local Dev & E2E

- [ ] README describes local setup clearly.  
- [ ] A full end-to-end flow (URL → Overview) works reliably on a fresh machine.  

---

## Summary

- **Iteration 1 Objective**: Build a **locally runnable CreatorSight** that:
  - Accepts a YouTube URL.  
  - Runs a **mock, but structurally representative** analysis pipeline.  
  - Stores results in a real DB.  
  - Renders an Overview + domain skeletons close to the PRD.  

- **Not Yet Included (Future Iterations)**:
  - Real Gemini-based multimodal analysis (FR-5–FR-11).  
  - YouTube OAuth + Analytics overlay (FR-12–FR-13).  
  - Rich per-domain visualizations & timelines.  
  - Large-scale reference library and robust similarity engine.  
  - Performance aggregation, exports, coaching.  

This document is the **Iteration 1 tasks spec** for CreatorSight.
