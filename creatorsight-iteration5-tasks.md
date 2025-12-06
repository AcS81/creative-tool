# CreatorSight – Iteration 5 Implementation Tasks (MVP Hardening & Sessions)

## Document Information
- **Product**: CreatorSight  
- **Iteration**: 5 – MVP Hardening & Sessions (“Finish the PRD MVP”)  
- **Version**: 1.0  
- **Status**: Ready for AI-Driven Implementation  
- **Target Outcome**: A locally runnable app where:
  - The full PRD MVP feature set (FR‑1–FR‑18) is implemented and verified.  
  - Users get a simple, reliable way to **revisit past analyses** (FR‑18 session management).  
  - The **Performance/Analytics mode** from Iteration 4 has clear E2E flows and automated tests.  
  - No “future roadmap” features (channel aggregation, exports, new platforms, etc.) are introduced yet.

> Iteration 5 is deliberately small: it closes the remaining PRD‑MVP gaps (session/history + performance-mode E2E/tests) without adding anything from the “Future Iterations” section of the PRD.

---

## High-level Scope for Iteration 5

This iteration focuses on:

- **Session & history (FR‑18)**  
  - Minimal, privacy‑friendly way to revisit prior analyses in this browser.  
  - Clear UI entry to “Your recent analyses” without full auth/accounts.

- **Performance mode verification**  
  - Finish the remaining Iteration 4 E2E and testing checkboxes.  
  - Ensure the Analytics path is as reliable and debuggable as the creative‑only path.

Out of scope:

- Channel‑level creator aggregation / “career profile”.  
- Export/shareable reports.  
- New platforms (TikTok / Shorts / Reels).  
- Bigger coaching/Exercises flows beyond existing insights.  

---

## Phase 0: PRD Completion Triage

### Task 0.1: Confirm PRD‑MVP Coverage

**Context**

- PRD Sections: 2.2 (Goals), 5 (Functional Requirements), 6 (Non‑functional), 8 (Roadmap).  
- Iterations 1–4 already cover FR‑1–FR‑17; Iteration 5 focuses on FR‑18 + remaining non‑functional gaps.

**Goals**

- [ ] Create a short internal note `docs/iteration_5_prd_mvp_status.md` that:
  - Lists each FR‑1–FR‑18 with a one‑line status: `implemented`, `verified`, or `covered by Iteration 5`.  
  - Calls out non‑functional requirements that matter for MVP and how they’re addressed (latency expectations, partial‑failure handling, privacy).  
  - Explicitly marks the “Future iterations (beyond this PRD)” section as **out of scope** for Iteration 5.

**Acceptance Criteria**

- [ ] `iteration_5_prd_mvp_status.md` exists and is checked into `docs/`.  
- [ ] FR‑1–FR‑18 mapping is clear enough that someone new can see what this iteration is finishing.  

---

## Phase 1: Session Management & History (FR‑18)

### Task 1.1: Lightweight Session Model

**Context**

- PRD FR‑18: “Basic session or simple account structure to revisit past analyses (lightweight for MVP).”  
- Current app lets users re‑run analysis and get back to the last analysis, but not browse a history.

**Goals**

- [ ] Introduce a lightweight notion of “viewer session” without full auth:
  - Generate a stable, anonymous `sessionId` stored in a secure cookie or localStorage.  
  - Associate each `VideoAnalysis` row with this `sessionId` (in addition to existing CreatorProfile link).  
  - Add helpers in `src/lib/session/` to read/write `sessionId` and fetch analyses for the current session.

**Constraints**

- No email/password or social login; keep users anonymous.  
- Respect privacy: session IDs should be opaque and revocable (e.g. clearing browser storage breaks the history).

**Acceptance Criteria**

- [ ] New `sessionId` column (or equivalent mechanism) wired into Prisma models and migrations.  
- [ ] New analyses created via `/api/analyze` are tagged with the current `sessionId`.  
- [ ] Helper utilities for session lookup are covered by unit tests.

---

### Task 1.2: “Recent Analyses” UI

**Context**

- PRD FR‑18 requires a way to revisit past analyses.  
- Iteration 3 added a way to get back to the last analysis; this task adds a small history view.

**Goals**

- [ ] Add a “Recent analyses” surface scoped to the current session:
  - Location options (pick one and keep it simple):  
    - A right‑side panel or section on the Overview screen, **or**  
    - A dedicated `/history` page linked from the app shell.  
  - Show a list of the last N analyses (e.g. 5–10) with:  
    - Thumbnail, title, channel name, created‑at timestamp.  
    - A “View analysis” action that loads that analysis into the existing Overview + domain views.  
- [ ] When no history exists, show a friendly empty state (“Run an analysis to see it here.”).

**Constraints**

- Reuse existing components and layouts where possible.  
- Do not introduce pagination or complex filters; simple recency ordering is enough for MVP.

**Acceptance Criteria**

- [ ] From a fresh browser session:
  - Run multiple analyses → they appear in “Recent analyses” in reverse chronological order.  
  - Clicking an entry loads that analysis without re‑calling Gemini/YouTube (uses stored fingerprint + metadata).  
- [ ] Clearing browser storage (or using a different browser) yields a clean slate with no history.

---

## Phase 2: Performance Mode E2E & Tests (Iteration 4 Finish)

### Task 2.1: Performance Mode API Tests

**Context**

- Iteration 4 introduced `performanceProfile`, Analytics, and the Performance tab.  
- Its spec still has open items for automated tests around the Analytics path in `/api/analyze`.

**Goals**

- [ ] Add API‑level tests (Vitest or similar) that:
  - Mock YouTube Data + YouTube Analytics + Gemini responses.  
  - Exercise `/api/analyze` in **performance mode** (OAuth present, analytics enabled).  
  - Assert that, given valid fixtures:  
    - `fingerprint.performanceProfile` is present and passes `validateFingerprint`.  
    - `hasPerformanceData` (or equivalent flag) is `true`.  
    - Failure cases (e.g. NotOwner / quota errors) still return a valid creative fingerprint and a clear error payload for performance.

**Constraints**

- No real network calls; all upstream APIs must be mocked.  
- Tests should be stable and fast enough to run in regular CI.

**Acceptance Criteria**

- [ ] New tests live alongside existing API tests (e.g. `src/tests/api/analyze.performance.test.ts`).  
- [ ] Tests pass locally and in CI, and cover both success and failure branches of the Analytics path.  

---

### Task 2.2: Performance Mode E2E Flow

**Context**

- Iteration 4’s `docs/iteration_4_e2e.md` describes a performance‑mode E2E, but its acceptance criteria for “fresh environment → full performance‑aware analysis” and E2E verification are still open.

**Goals**

- [ ] Update and finalize `docs/iteration_4_e2e.md` to reflect the current implementation and environment variables.  
- [ ] Perform a full manual E2E run on a fresh environment with valid keys:
  1. Configure env + OAuth client, run migrations/seeds.  
  2. Start dev server.  
  3. Connect YouTube via OAuth.  
  4. Paste a URL for a video on the connected channel.  
  5. Run analysis and confirm:  
     - Overview shows “Performance at a glance” card when performance data is present.  
     - Performance tab displays retention curve, metrics, and performance‑aware coaching insights.  
- [ ] Optionally add a single lightweight browser‑level E2E test (Playwright/Cypress) for performance mode, **only if** it can run fully with mocked upstream APIs.

**Constraints**

- Keep any automated E2E very small; the main requirement is a documented, reproducible manual flow.  
- Do not introduce additional env complexity beyond what Iteration 4 already requires.

**Acceptance Criteria**

- [ ] `docs/iteration_4_e2e.md` accurately describes a working performance‑mode setup.  
- [ ] A fresh environment following that doc can complete a full performance‑aware analysis end‑to‑end.  
- [ ] If an automated E2E test is added, it passes reliably with mocks and is documented in the README.

---

## Phase 3: “MVP Complete” Dev Experience

### Task 3.1: README & Iteration 5 Summary

**Context**

- Earlier iterations added per‑iteration E2E docs; this iteration should close the loop with a concise “MVP complete” story.

**Goals**

- [ ] Update `README.md` to include:
  - A short “What’s included in the MVP” section explicitly tying features back to the PRD (URL input, creative fingerprint, reference similarity, Performance domain, sessions/history).  
  - A brief explanation of the three main run modes:
    - Mock only.  
    - Gemini creative‑only.  
    - Gemini + Analytics (performance mode).  
  - A pointer to the relevant E2E docs (`iteration_2_e2e`, `iteration_3_e2e`, `iteration_4_e2e`) and how they fit together.  
- [ ] Add a short `docs/iteration_5_e2e.md` with:
  - A quick checklist that combines:  
    - Running an analysis.  
    - Revisiting it via “Recent analyses”.  
    - (Optional) Running performance mode once to see the Performance tab.

**Acceptance Criteria**

- [ ] Someone new to the repo can, in <10 minutes:  
  - Clone, install, migrate/seed.  
  - Run in mock mode, analyze at least one video, and revisit it via history.  
  - Understand how to enable Gemini and Analytics later if they choose.  
- [ ] All existing tests + new tests from this iteration pass.

---

## Phase Transition Checklist (Iteration 5)

Use this checklist to confirm **Iteration 5** is complete.

### ✅ PRD‑MVP Coverage

- [ ] FR‑1–FR‑18 are all mapped to concrete implementation status in `iteration_5_prd_mvp_status.md`.  
- [ ] No items from the PRD “Future iterations (beyond this PRD)” section were added in this iteration.

### ✅ Session Management & History

- [ ] Anonymous `sessionId` is created and associated with each `VideoAnalysis`.  
- [ ] “Recent analyses” shows the last N analyses for the current session and lets users reopen them.

### ✅ Performance Mode Verification

- [ ] API‑level tests cover the Analytics/performance path of `/api/analyze`.  
- [ ] Performance‑mode E2E flow for a fresh environment is documented and reproducible.

### ✅ Dev Experience

- [ ] README clearly describes the MVP, run modes, and where to look for E2E guides.  
- [ ] `iteration_5_e2e.md` provides a concise checklist to sanity‑check sessions/history + (optionally) performance mode.

---

## Summary

- **Iteration 5 Objective**: Take CreatorSight from “feature‑complete in practice” to “PRD‑MVP complete and verified” by:
  - Adding a lightweight session/history flow that fulfills FR‑18.  
  - Finishing performance‑mode E2E and tests introduced in Iteration 4.  
  - Tightening docs so new contributors can understand and run the full MVP without touching any future‑roadmap features.

