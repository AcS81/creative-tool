# CreatorSight – Iteration 4 Implementation Tasks (Performance & Analytics Slice)

## Document Information
- **Product**: CreatorSight  
- **Iteration**: 4 – Performance & Analytics Slice (“How the Audience Responds”)  
- **Version**: 1.0  
- **Status**: Ready for AI-Driven Implementation  
- **Target Outcome**: A locally runnable app where:
  - A creator can paste a YouTube URL for a video they **own**, connect their channel via **YouTube OAuth**, and have CreatorSight:
    - Run the existing Gemini-powered creative analysis pipeline (Iterations 2–3).  
    - Fetch **retention, CTR, and core engagement metrics** from YouTube Analytics.  
    - Align retention and drop-off points with the narrative beats and scenes already produced by Gemini.  
  - The UI exposes a new **Performance domain (H)** with:
    - A retention curve over time, annotated with story beats and key moments.  
    - Basic performance metrics (CTR, views, avg view duration, likes, comments).  
    - Performance-aware coaching insights that connect creative patterns to audience response.  
  - If Analytics is not connected, the existing Iteration 3 experience still works exactly as before (creative fingerprint + UX + coaching v1).

> Iteration 4 adds the “Performance” part of the creative x-ray: not just *how* you make videos, but *how viewers actually respond*.

---

## High-level Scope for Iteration 4

From the PRD, this iteration implements:

- **Performance integration (FR-12, FR-13)**:
  - YouTube OAuth (read-only).  
  - Video-level Analytics (retention, CTR, views, likes, comments, avg view duration).  
- **Performance domain (H)** in the fingerprint:
  - A structured `performanceProfile` attached to each analysis when Analytics is available.  
- **Performance UI**:
  - A dedicated Performance tab.  
  - “Performance at a glance” summary on Overview.  
- **Coaching v2**:
  - Extend Iteration 3’s creative-only insights to also consider the retention curve and basic metrics.  

Out of scope for this iteration:

- Channel-level aggregation (multi-video creator profiles).  
- Advanced coaching flows (multi-video drills, exercises library).  
- Export/sharing of reports.  

These become candidates for Iteration 5+.

---

## Phase 0: Preconditions & Schema Adjustments

### Task 0.1: Confirm Iterations 1–3 as Stable Base

**Context**

- PRD Sections: 5.5 (Fingerprint & Similarity), 7 (Pipelines).  
- Iterations 1–3 established:
  - Core data model and mock + Gemini analysis.  
  - Extended creative fingerprints (domains B–G).  
  - Polished UX and creative-only coaching.  
- Before adding Analytics, the base needs to be predictable.

**Goals**

- [ ] Verify that:
  - Fingerprint schema and Zod types are up-to-date and used consistently.  
  - `/api/analyze`’s behavior is well-defined for success/failure, with `VideoAnalysis.status` and error payloads used in the UI.  
  - Existing insights/coaching logic is deterministic and well-tested.  

**Constraints**

- No new functionality here; this is a validation pass.  

**Acceptance Criteria**

- [ ] A short internal note (e.g. `docs/iteration_4_preflight.md`) summarizes:
  - Current fingerprint shape.  
  - `/api/analyze` semantics.  
  - Any known limitations that Iteration 4 must respect.  

---

### Task 0.2: Extend Fingerprint for Performance Domain (H)

**Context**

- PRD Sections: 1.3 (Solution), 4.3 (Performance), 5.4–5.5 (FR-12–FR-15).  
- Need a dedicated **Performance** domain that can be present or absent.

**Goals**

- [ ] In `src/lib/types/` and `src/lib/schemas/fingerprint.ts`, define an optional `performanceProfile`:
  - `scores` (0–100, derived from analytics), e.g.:  
    - `hookRetention`  
    - `midVideoRetentionStability`  
    - `lateDropOffSeverity` (higher = worse)  
    - `clickThroughRateQuality`  
  - `metrics` (normalized raw stats), e.g.:  
    - `views`, `likes`, `comments`  
    - `ctr` (click-through rate)  
    - `avgViewDurationSeconds`  
    - `retentionSeries`: normalized array of `{ timeRatio: number; audienceRetention: number }`  
  - `summaryText`: brief narrative of how the video performs overall.  
  - `insights`: optional structured list of performance-specific insights (to be populated later).  
- [ ] Add a top-level `hasPerformanceData: boolean` flag (or treat `performanceProfile != null` as the contract and add a helper like `fingerprintHasPerformance`).

**Constraints**

- `performanceProfile` must be **optional** so analyses without Analytics remain valid.  
- Keep the retention series reasonably compact (e.g. <= 100 points).

**Acceptance Criteria**

- [ ] TypeScript + Zod compile and align.  
- [ ] Tests include:
  - Fingerprints with and without `performanceProfile`.  
  - Invalid performance shapes causing validation failures with clear errors.  

---

## Phase 1: YouTube OAuth & Token Storage (FR-12)

### Task 1.1: OAuth Config & Data Model

**Context**

- PRD Section 5.4 (FR-12 – YouTube OAuth), 6 (Privacy & Data).  
- We need read-only OAuth to fetch Analytics for videos the user owns.

**Goals**

- [ ] Add env/config keys:
  - `GOOGLE_CLIENT_ID`  
  - `GOOGLE_CLIENT_SECRET`  
  - `GOOGLE_REDIRECT_URL` (or `YOUTUBE_OAUTH_REDIRECT_URL`)  
- [ ] Extend the data model (Prisma) with minimal auth entities, e.g.:
  - `User` (or reuse `CreatorProfile` if appropriate) with `googleAccountId`, `email?`.  
  - `AuthToken` or fields on User for:
    - `accessToken`, `refreshToken`, `expiry`, `scopes`.  
  - Ensure tokens are stored encrypted at rest.  
- [ ] Add a small auth context helper (e.g. `src/lib/auth/context.ts`) to:
  - Resolve the current user (session/cookie).  
  - Provide an `AuthContext` object to backend functions.

**Constraints**

- Scopes must be limited to **read-only** YouTube/Analytics.  
- No heavy multi-user system; enough for a few test users.

**Acceptance Criteria**

- [ ] Migrations run successfully with the new auth schema.  
- [ ] Config helper fails fast if OAuth env vars are required but missing (when performance mode is enabled).

---

### Task 1.2: OAuth Flow Endpoints & UI Hooks

**Context**

- PRD Section 5.4 (FR-12).  
- Need a basic “Connect YouTube” experience from the UI.

**Goals**

- [ ] Implement backend routes/handlers:
  - `GET /api/auth/youtube/start` → redirects to Google OAuth consent.  
  - `GET /api/auth/youtube/callback` → handles the authorization code, exchanges for tokens, stores tokens, associates with a user.  
- [ ] Add a simple UI entry point (e.g. in Settings or Overview) to:
  - Show “YouTube: Not connected” → button “Connect YouTube”.  
  - Show “YouTube: Connected” → option to disconnect (token revocation or deletion).  

**Constraints**

- Handle revoked/expired tokens gracefully (mark connection as invalid and prompt reconnection).  
- Follow the privacy guidance in the PRD (no extra data stored).

**Acceptance Criteria**

- [ ] Manual test:
  - Clicking “Connect YouTube” runs a full OAuth flow and stores tokens.  
  - Status component reflects connection state.  
  - Disconnect removes stored tokens and prevents further Analytics calls.  

---

## Phase 2: YouTube Analytics Wrapper (FR-13)

### Task 2.1: Analytics Client & Normalization

**Context**

- PRD Section 5.4 (FR-13 – Analytics retrieval).  
- We want a thin wrapper that hides YouTube Analytics API complexity.

**Goals**

- [ ] Implement `src/lib/youtube/analytics.ts` with a main function:
  - `fetchVideoAnalytics(params: { videoId: string; channelId: string; auth: AuthContext })` → returns a `VideoAnalytics` object containing:
    - `retentionSeries` (normalized as in Task 0.2).  
    - `ctr`  
    - `views`  
    - `avgViewDurationSeconds`  
    - `likes`, `comments` (if available).  
- [ ] Normalize key YouTube Analytics responses into this shape.  
- [ ] Represent common error types via a small error union:
  - `NotOwner` (video not part of that channel).  
  - `Forbidden` (scopes/permissions).  
  - `QuotaExceeded`.  
  - `UpstreamError`.

**Constraints**

- No direct use of raw YouTube Analytics responses elsewhere; always go through this wrapper.  
- All network calls must be mockable for tests.

**Acceptance Criteria**

- [ ] For a valid owned video (manual test with real keys), the wrapper returns a populated `VideoAnalytics`.  
- [ ] Unit tests (with mocked HTTP) cover success, NotOwner, Forbidden, and QuotaExceeded cases.

---

### Task 2.2: Align Analytics with Beats & Scenes

**Context**

- PRD Sections: 4.1 (Overview – retention vs content timeline), 4.3 (Narrative & Performance).  
- Need a consistent “timeline” representation to overlay beats, scenes, and retention.

**Goals**

- [ ] Implement helper in `src/lib/analysis/performanceTimeline.ts` to:
  - Take `VideoAnalytics.retentionSeries` (timeRatio 0–1) and:  
    - `beats` from narrative analysis.  
    - `sceneSegments` from Gemini.  
  - Produce an aligned structure such as:
    - `{ timeRatio: number; retention: number; beatLabel?: string; sceneLabel?: string }[]`.  
- [ ] Ensure mapping is by **time ratio**, not absolute durations, so it works across different video lengths.

**Constraints**

- Keep alignment simple and deterministic.  
- Do not require millisecond-perfect sync; approximate mapping is fine for MVP.

**Acceptance Criteria**

- [ ] For test fixtures, timestamps are mapped to reasonable positions along the retention curve.  
- [ ] The resulting timeline is suitable for direct charting in the Performance UI.

---

## Phase 3: Performance Profile Builder & Pipeline Integration

### Task 3.1: Build `performanceProfile` from Analytics

**Context**

- PRD Sections: 5.4–5.5 (Performance integration & fingerprint construction).  
- Need a deterministic, explainable mapping from analytics → performance domain.

**Goals**

- [ ] Implement `src/lib/analysis/performanceProfile.ts` with:
  - `buildPerformanceProfile(args: { analytics: VideoAnalytics; alignedTimeline: AlignedTimeline })` → `PerformanceProfile`.  
- [ ] The function should:
  - Compute scores (0–100) for:
    - `hookRetention`: retention around the first few % of time relative to mid-video baseline.  
    - `midVideoRetentionStability`: measure variance in the middle section.  
    - `lateDropOffSeverity`: how sharply retention falls in the last quarter.  
    - `clickThroughRateQuality`: based on CTR vs a simple expected range.  
  - Produce `metrics` populated directly from `VideoAnalytics`.  
  - Generate a short `summaryText` describing overall performance in plain language.

**Constraints**

- No ML; keep rules straightforward and document them in comments.  
- Must be deterministic for given inputs.

**Acceptance Criteria**

- [ ] For analytics fixtures, `buildPerformanceProfile` returns consistent scores and a non-empty summary.  
- [ ] Missing metrics (e.g. likes not available) are handled gracefully without crashes.

---

### Task 3.2: Integrate Performance into `analyzeVideo` Pipeline

**Context**

- PRD Section 7 (Pipelines).  
- `analyzeVideo` already orchestrates Gemini + reference similarity.

**Goals**

- [ ] Extend `analyzeVideo` (e.g. `src/lib/analysis/service.ts`) to:
  - Check whether the current user has valid Analytics tokens and whether performance mode is enabled via config.  
  - For owned videos with Analytics enabled:
    - Call `fetchVideoAnalytics`.  
    - Build aligned timeline from analytics + beats/scenes.  
    - Call `buildPerformanceProfile`.  
    - Attach `performanceProfile` and `hasPerformanceData = true` to the fingerprint.  
  - For all other cases:
    - Skip Analytics, leaving `performanceProfile` undefined or null and `hasPerformanceData = false`.  
  - Include performance-related diagnostics in the result for logging/debugging.

**Constraints**

- If Analytics fails, the creative fingerprint must still be created and persisted.  
- The external `AnalyzeVideoResult` shape should remain backward-compatible (only add fields).

**Acceptance Criteria**

- [ ] When Analytics is available:
  - `/api/analyze` responds with `fingerprint.performanceProfile` set and `hasPerformanceData = true`.  
- [ ] When Analytics is unavailable:
  - Creative fingerprint is returned as in Iterations 2–3; `hasPerformanceData = false`.  
- [ ] Analytics failures are surfaced in diagnostics and logs but do not break analyses.

---

## Phase 4: Performance UI & Coaching v2

### Task 4.1: Performance Tab – Retention & Metrics

**Context**

- PRD Sections: 4.1 (retention vs content timeline), 4.3 (Performance domain).  
- Need a clear, focused Performance tab.

**Goals**

- [ ] Add/complete a `Performance` tab in the analysis navigation.  
- [ ] Implement a `PerformanceView` component that:
  - Uses the aligned timeline to render a line chart:
    - X-axis: time (0–100% of video).  
    - Y-axis: audience retention %.  
    - Beat/scene markers or tooltips along the curve.  
  - Shows key metrics in a stats panel (views, CTR, avg view duration, likes, comments).  
  - Displays `performanceProfile.summaryText` prominently.  
- [ ] Provide clear empty states:
  - If `hasPerformanceData = false`, show an explanation and a “Connect YouTube” CTA.

**Constraints**

- Reuse `recharts` or existing charting library.  
- Must work on mobile and desktop; avoid clutter.

**Acceptance Criteria**

- [ ] For analyses with performance data:
  - Performance tab shows retention + metrics + summary without errors.  
- [ ] For analyses without performance data:
  - Tab shows a friendly message and no broken charts.

---

### Task 4.2: Performance-Aware Coaching Insights

**Context**

- PRD Sections: 3.2 (Compare myself to big channels), 4.1 (“Where you’re unusual vs typical”), 5.4 (Performance domain).  
- Iteration 3 introduced creative-only coaching; now we incorporate retention/CTR.

**Goals**

- [ ] Extend or add a coaching helper (e.g. `src/lib/analysis/coaching.ts`) that:
  - Takes both `fingerprint` and `performanceProfile` (if present) plus reference fingerprints.  
  - Produces performance-aware insights such as:
    - “Your hook loses more viewers than typical for your archetype; consider tightening the first 10 seconds and adding a stronger visual change.”  
    - “Mid-video retention is unusually strong when you switch into story mode; consider foregrounding that pattern earlier.”  
  - Returns a structured list of insights categorized as:
    - `hook`, `midVideo`, `end`, or `overall`.  
- [ ] Update UI:
  - Performance tab shows 3–5 performance-specific insights.  
  - Overview may surface 1–2 of the most important ones in a “Performance at a glance” area.

**Constraints**

- Keep rules explainable; insights should reference observable metrics (“retention drops 30% at X”) and creative domains (“narrative structure strength”).  
- When performance data is missing, fall back to creative-only coaching (Iteration 3 behavior).

**Acceptance Criteria**

- [ ] For fingerprints with performance data:
  - Coaching outputs include at least a couple of insights that clearly reference both creative style and performance.  
- [ ] For fingerprints without performance data:
  - Coaching gracefully falls back to existing creative-only insights with no errors.  

---

### Task 4.3: Overview “Performance at a Glance”

**Context**

- PRD Section 4.1 (Overview).  
- Overview should acknowledge performance without becoming a full analytics console.

**Goals**

- [ ] On Overview, add a small “Performance at a glance” card when `hasPerformanceData = true` that includes:
  - A short retention summary (e.g. “You retain 65% of viewers at the 50% mark vs reference median 50% for similar videos.”).  
  - One or two top performance-aware coaching bullets.  
- [ ] If `hasPerformanceData = false`, show a minimal call-to-action to connect YouTube.

**Constraints**

- Keep this section compact; detailed visuals remain in the Performance tab.  

**Acceptance Criteria**

- [ ] Overview clearly indicates whether performance data was used.  
- [ ] The extra information does not overwhelm the main archetype + radar content.

---

## Phase 5: Privacy, Settings & E2E

### Task 5.1: Privacy & Settings for Analytics

**Context**

- PRD Section 6 (Privacy & Data).  
- With OAuth and Analytics, the app must clearly communicate what’s stored and allow revocation.

**Goals**

- [ ] Extend the existing Settings/Privacy surface (Iteration 3) to:
  - Show Analytics connection status and last successful Analytics fetch (timestamp/short note).  
  - Allow the user to revoke tokens (disconnect YouTube).  
  - Briefly explain what Analytics data is stored:
    - No raw video.  
    - Only metrics and derived fingerprints.  
    - OAuth tokens encrypted and revocable.  

**Constraints**

- Copy should be concise and non-legalese but accurate.  

**Acceptance Criteria**

- [x] After revocation, no further Analytics calls are possible until reconnection.  
- [x] Settings UI and behavior matches the storage reality.

---

### Task 5.2: README & E2E Flows for Performance Mode

**Context**

- PRD Section 6 (Non-functional), earlier iterations’ docs.  
- Need clear instructions for running in three modes:
  - Mock-only.  
  - Gemini creative-only.  
  - Gemini + Analytics (this iteration).

**Goals**

- [x] Update `README.md` and add `docs/iteration_4_e2e.md` to describe:
  - Additional env vars for OAuth and Analytics.  
  - How to obtain client credentials and configure redirect URLs.  
  - E2E test flow for performance mode:
    1. Configure env, run migrations/seeds.  
    2. Start dev server.  
    3. Connect YouTube via OAuth.  
    4. Paste a URL for a video on the connected channel.  
    5. Run analysis and confirm:
       - Overview shows “Performance at a glance.”  
       - Performance tab shows retention, metrics, and performance-aware coaching.  
  - How to fall back to mock or creative-only modes when no keys are available.  
- [ ] Add or extend API-level tests (with mocked upstream APIs) to:
  - Exercise the Analytics path in `/api/analyze`.  
  - Assert that `performanceProfile` is attached when performance mode is enabled.

**Constraints**

- Tests must use mocks; no real network calls in automated suites.

**Acceptance Criteria**

- [ ] From a fresh environment with valid keys, a person can follow docs to complete a full performance-aware analysis.  
- [ ] Automated tests for performance mode pass alongside existing suites.

---

## Phase Transition Checklist (Iteration 4)

Use this checklist to confirm **Iteration 4** is complete.

### ✅ Performance Domain & Analytics

- [x] Fingerprint supports optional `performanceProfile` and `hasPerformanceData`.  
- [x] OAuth and Analytics are configured and tokens stored securely.  
- [x] `fetchVideoAnalytics` reliably returns normalized retention + metrics for owned videos.

### ✅ Performance-Aware Fingerprints

- [x] `buildPerformanceProfile` converts analytics into stable scores, metrics, and a summary.  
- [x] `analyzeVideo` attaches `performanceProfile` when Analytics is available without breaking creative-only flows.

### ✅ UI & Coaching

- [x] Performance tab visualizes retention over time with beats/scenes and shows core metrics.  
- [x] Performance-aware coaching insights connect creative fingerprints and retention/CTR.  
- [x] Overview surfaces a compact “Performance at a glance” without overwhelming core content.

### ✅ Privacy & Dev Experience

- [x] Settings/Privacy accurately reflects Analytics usage and allows disconnection.  
- [x] README and iteration 4 docs describe mock, creative-only, and performance modes.  
- [ ] Manual and automated E2E flows for performance mode succeed.

---

## Summary

- **Iteration 1**: Local mock MVP – URL → mock analysis → fingerprint + Overview + domain skeletons.  
- **Iteration 2**: Gemini-powered creative analysis – real transcript/scenes and rich fingerprints across domains B–G.  
- **Iteration 3**: Experience & coaching upgrade – polished UX, improved Overview + domain views, and creative-only insights.  
- **Iteration 4 (this document)**: Adds the **Performance & Analytics Slice**, connecting YouTube Analytics (retention, CTR, engagement) to the creative fingerprint so creators can see **how their style lands with audiences** and get grounded, performance-aware coaching.
