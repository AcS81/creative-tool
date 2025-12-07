# Iteration 5 – PRD MVP Status (FR‑1–FR‑18)

Use this note to see how the current codebase maps to the PRD functional requirements and what Iteration 5 is finishing.

---

## Functional Requirements Status (FR‑1–FR‑18)

Status legend:
- `implemented` – feature is present and used in the app.
- `verified` – implemented and covered by unit/API/E2E tests or documented flows.
- `covered by Iteration 5` – work intentionally scoped to this iteration.

- **FR‑1 – YouTube URL intake** – Status: **verified**. Implemented via `parseYouTubeUrl` / `isValidYouTubeUrl` and used by `/api/analyze` and the landing form; covered by `src/lib/youtube.test.ts` and Iteration 1/2 E2E docs.
- **FR‑2 – Video metadata retrieval** – Status: **verified**. Implemented via `fetchYoutubeMetadata` (`src/lib/youtube/api.ts`) and consumed in `/api/analyze`; behavior and error mapping are covered by `src/lib/youtube/api.test.ts`.
- **FR‑3 – Creator profiles** – Status: **verified**. Implemented in Prisma models (`CreatorProfile`, `VideoAnalysis`, `VideoFingerprint`) and used by `/api/analyze`; exercised by API tests (`src/app/api/analyze/route.test.ts`) and E2E docs (`docs/iteration_1_e2e.md`, `docs/iteration_2_e2e.md`).
- **FR‑4 – Reference creators** – Status: **verified**. Seeded via `prisma/seed.ts` as `CreatorProfile.type = "reference"` with fingerprints; similarity and usage in `/api/analyze` are covered by `src/lib/analysis/similarity.test.ts` and the seed/E2E flows.
- **FR‑5 – Transcript & segmentation** – Status: **verified**. Implemented via `getTranscriptAndScenes` (`src/lib/gemini/client.ts`), which returns transcript and scene segments from Gemini; covered by `src/lib/gemini/client.test.ts` and the analysis service tests.
- **FR‑6 – Voice analysis (B1–B3)** – Status: **verified**. Implemented in the multimodal Gemini call (`analyzeVideoMultimodal`), producing v2 domain profiles; schema and parsing are covered by multimodal validator tests.
- **FR‑7 – Language & content analysis (C)** – Status: **verified**. Delivered via the multimodal analyzer; domain scores/axis details validated by multimodal tests and schema checks.
- **FR‑8 – Narrative & device analysis (D)** – Status: **verified**. Multimodal beats (with roles) and devices flow into the fingerprint; validated by multimodal parsing tests and downstream service tests.
- **FR‑9 – Visual presence analysis (E)** – Status: **verified**. Multimodal visual metrics populate domain scores and axis details; exercised in multimodal tests and the UI.
- **FR‑10 – Editing & pacing analysis (F)** – Status: **verified**. Cut rate/pattern interrupts/B-roll from the multimodal response drive editing scores; validated by schema/tests and “Where you’re unusual.”
- **FR‑11 – Soundscape analysis (G)** – Status: **verified**. Music coverage/changes and SFX are sourced from the multimodal response; validated by schema/tests and visible in the Sound tab.
- **FR‑12 – YouTube OAuth (optional)** – Status: **implemented**. Implemented via Google OAuth helpers (`src/lib/auth/google.ts`), Prisma `User`/`YoutubeAuthToken` models, and routes under `/api/auth/youtube/*`; helper behavior is tested (`google.test.ts`), while Iteration 4 E2E doc (`docs/iteration_4_e2e.md`) covers the manual flow. Iteration 5 will mainly add more performance‑mode verification, not new OAuth features.
- **FR‑13 – Analytics retrieval (optional)** – Status: **implemented**. Implemented via `fetchVideoAnalytics` (`src/lib/youtube/analytics.ts`) plus performance timeline/profile builders and the `Performance` tab; normalization and error mapping are covered by `analytics.test.ts` and performance profile/timeline tests. Iteration 5 will add API‑level tests around `/api/analyze` in performance mode and tighten the E2E documentation.
- **FR‑14 – Creative fingerprint construction** – Status: **verified**. Canonical fingerprint is v2 (`version=1.2.0`), assembled via `analyzeVideo` with multimodal profiles + beats/axisDetails; schema tests include legacy upgrade handling.
- **FR‑15 – Reference library & similarity** – Status: **verified**. Implemented via seeded reference fingerprints and similarity helpers (`computeAverageMetaAxes`, `findNearestReferences` in `similarity.ts`), used by `/api/analyze` to return nearest reference creators and niche-average meta axes; covered by `similarity.test.ts` and API tests.
- **FR‑16 – Overview page** – Status: **verified**. Implemented in `src/app/page.tsx` with hero, metadata card, archetype card, overview radar chart, nearest neighbours, and “Where you’re unusual”; verified by Iteration 1–4 E2E docs and exercised continuously in manual flows.
- **FR‑17 – Domain views (Voice, Language, Narrative, Visual, Editing, Sound, Performance)** – Status: **verified** (creative domains) / **implemented** (Performance). Creative domain tabs use multimodal-driven data; the Performance tab overlays retention with multimodal beat markers and coaching. Covered by unit/API tests and `docs/iteration_4_e2e.md`.
- **FR‑18 – Session management / revisit past analyses** – Status: **covered by Iteration 5**. Current app lets users run analyses but does not yet expose session‑scoped history. Iteration 5 Tasks 1.1–1.2 will add a lightweight `sessionId` (stored client‑side and persisted on `VideoAnalysis`) and a simple “Recent analyses” UI surface to fulfill FR‑18.

---

## Non‑functional Requirements (MVP‑relevant)

From PRD Section 6, key non‑functional traits and how they’re currently addressed:

- **Latency & cost**
  - Gemini + YouTube calls are synchronous in `/api/analyze`; README explicitly sets expectations of up to ~5–10 minutes for long videos and recommends lighter Gemini models for lower cost/latency.
  - Queue‑based workers and true async processing are not implemented yet; acceptable for MVP with low volume but left as a future scaling enhancement.

- **Partial‑failure handling & reliability**
  - `/api/analyze` uses structured error types (`ConfigError`, `YoutubeApiError`, `GeminiApiError`) and persists `VideoAnalysis.status` + `failureReason` on failure, so creative‑pipeline errors are visible in logs and DB.
  - Performance/Analytics is optional: failures in `fetchVideoAnalytics` or downstream performance processing are caught in `analyzeVideo`, logged, and the fingerprint falls back to `hasPerformanceData = false` while preserving the creative fingerprint.
  - Per‑domain Gemini failures currently fail the whole analysis request rather than marking a single domain as “partial”; this behavior is acceptable for MVP but can be revisited later if finer‑grained partial results are needed.

- **Privacy & data handling**
  - The app never downloads or stores raw video; it stores YouTube URLs, derived fingerprints, and (optionally) YouTube Analytics metrics, in line with PRD guidance.
  - OAuth tokens are stored encrypted at rest using `TOKEN_ENCRYPTION_KEY` (`src/lib/auth/crypto.ts`) and can be revoked via the Disconnect UI or by clearing token rows.
  - README and the landing page explicitly communicate what is stored and how to disconnect YouTube, matching the PRD’s privacy expectations.

- **Scalability & environment**
  - Current deployment target is local / low‑volume usage (single Next.js app + SQLite), which matches the MVP “invite‑based / early access” scope.
  - Config helpers (`getAppConfig`) validate env vars for Gemini and Performance modes up front, failing fast with clear error messages when misconfigured.

---

## Future Iterations – Explicitly Out of Scope for Iteration 5

Per PRD Section 8 (“Future Iterations – beyond this PRD”), the following remain **out of scope for Iteration 5**:

- Channel‑level creator aggregation / long‑term “career profile” views.
- Exportable or shareable reports (PDF/HTML exports).
- Additional platforms beyond YouTube (TikTok / Shorts / Reels / Instagram).
- Advanced multi‑video coaching flows, exercises, or “break your archetype” modes beyond the current coaching.

Iteration 5’s mandate is to:
- Close the remaining PRD‑MVP gaps around **FR‑18 (sessions/history)** and
- Tighten **non‑functional coverage** (especially performance‑mode tests and E2E repeatability),
without introducing any of the above future‑roadmap features.
