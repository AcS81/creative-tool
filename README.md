# CreatorSight – PRD MVP (Iterations 1–6)

CreatorSight is a local Next.js app for analyzing YouTube videos. Across Iterations 1–5 it has reached the PRD MVP: URL input, creative fingerprint, reference similarity, Performance domain, and lightweight sessions/history.

## Stack
- Next.js 16 (App Router, TypeScript, Tailwind CSS 4)
- Prisma + SQLite (file-based)
- ESLint + Prettier
- Vitest for unit tests, Recharts for radar visualization

## Getting started
1) Prerequisites: Node 18+ (tested on Node 24), npm.
2) Install dependencies: `npm install`
3) Copy envs: `cp .env.example .env` (adjust DB path if needed). The default `ANALYSIS_MODE=mock` keeps everything local.
4) Run migrations (includes latest columns such as `failureReason`, auth tables, sessions, video metadata):  
   - `npm run prisma:migrate -- --name init` (first time)  
   - `npm run prisma:migrate -- --name add-failure-reason` (if you pulled after that change)  
   - `npm run prisma:migrate -- --name add-oauth-auth-tables` (if not already applied)  
   - `npm run prisma:migrate -- --name add-session-id` (if not already applied)  
   - `npm run prisma:migrate -- --name add-video-metadata` (if not already applied)
   - `npm run prisma:migrate -- --name add-analysis-worker` (if not already applied)
5) (Optional) Seed reference creators: `npm run seed`
6) Start the app + worker: `npm run dev:all` then open http://localhost:3000.
7) Optional demo: click “Try a sample analysis” on the landing card to see the full experience without external keys.

## Useful scripts
- `npm run dev` / `npm run dev:all` / `npm run build` / `npm start`
- `npm run lint`
- `npm run format` / `npm run format:fix`
- `npm run prisma:migrate -- --name <label>` (SQLite)
- `npm run prisma:studio` (opens Prisma Studio)
- `npm run seed` (populate reference creators + fingerprints)
- Seed note: Option B chosen—refresh seeds with a one-time Gemini run. Until you run the refresh (see `docs/reference_seed_refresh.md`), seeds stay mock-generated for determinism.
- `npm run test` (Vitest)
- `npm run probe:ingestion` (dev probe for Gemini URL ingestion)
- `npm run eval:golden` (run multimodal pipeline against the documented golden YouTube set)
- `npm run visual:check` (optional Playwright screenshots of landing/sample/performance; requires `npm install` to fetch Playwright)
- `npm run worker` (durable local analysis worker)

## Notes
- Durable analyses require the local worker (`npm run worker`); `npm run dev:all` runs app + worker together.
- `/` lets you paste a YouTube URL, run the analysis API, and see archetype, radar chart (with reference average), nearest references, overview insights, and domain tabs (radars + score bars + micro-insights). A sample analysis button is available for instant demo.
- The Overview now also includes a “Recent analyses (this browser)” panel, powered by an anonymous `sessionId`, so you can reopen recent runs without re-calling Gemini/YouTube.
- Prisma models include core entities (`CreatorProfile`, `VideoAnalysis`, `VideoFingerprint`, `User`, `YoutubeAuthToken`); see `docs/iteration_5_prd_mvp_status.md` for a PRD FR‑1–FR‑18 mapping.

## What’s included in the MVP (PRD)

The current app covers the PRD MVP features:
- **URL input (FR‑1–FR‑2)** – Paste any public/unlisted YouTube URL; we validate it, fetch metadata, and show title/channel/thumbnail/duration.
- **Creative fingerprint (FR‑5–FR‑11, FR‑14)** – Gemini-powered transcript + domain analysis (Voice, Language, Narrative, Visual, Editing, Sound) produces a structured fingerprint used throughout the UI.
- **Reference similarity (FR‑3–FR‑4, FR‑15)** – Seeded reference creators and a similarity engine drive the “Nearest reference creators” card and “Where you’re unusual” insights.
- **Performance domain (FR‑12–FR‑13)** – Optional YouTube OAuth + Analytics attach a `performanceProfile` (retention curve, CTR, views, likes, comments) and unlock the Performance tab and “Performance at a glance.”
- **Sessions & history (FR‑18)** – Anonymous `sessionId` (cookie-based) tags each `VideoAnalysis`; the Overview screen shows a recent-analyses list so you can reopen past runs in this browser.

## Analysis modes
- **Mock only** (`ANALYSIS_MODE=mock`, default): deterministic, offline-friendly analysis that exercises the full fingerprint + UI without external APIs. Good for local dev and quick demos.
- **Gemini creative-only** (`ANALYSIS_MODE=gemini` with `GEMINI_API_KEY`, `YOUTUBE_API_KEY`): real Gemini + YouTube Data API, covering transcript, domains, fingerprints, and reference similarity (no Analytics/performance overlay).
- **Gemini + Analytics** (`ANALYSIS_MODE=gemini` + performance envs): adds YouTube Analytics (retention, CTR, engagement) and computes a performance domain + coaching on top of the creative fingerprint.
- Performance tab overlays retention with multimodal beats (hook/setup/escalation/payoff/outro) when available; without Analytics, the creative view stays unchanged.
- Multimodal regression helper: `npm run golden:multimodal` runs a small golden set (requires Gemini keys; see `docs/multimodal_golden_set.md`).
- Alignment & Load preview: mock mode and seeds now surface alignment/drift/balance/timing and cognitive-load timelines (Overview “Alignment & Load” section).
- Rollback: set `ENABLE_ADVANCED_METRICS=false` to force placeholder alignment/load metrics (schema stays v1.3.0) while keeping the rest of the analysis live.
- Structure pass control: `ENABLE_STRUCTURE_PASS=false` skips tier 0 and uses fallback skeletons; `STRUCTURE_PASS_TIMEOUT_MS` sets the tier 0 timeout in ms.

### Run in mock mode
1) Ensure `.env` has `ANALYSIS_MODE=mock`.
2) `npm run dev` and analyze any YouTube URL (data is deterministic). Or click “Try a sample analysis” to load prebuilt results instantly.

### Run in gemini mode (creative-only)
1) Set in `.env`:  
   - `ANALYSIS_MODE=gemini`  
   - `GEMINI_API_KEY=<your key>`  
   - `YOUTUBE_API_KEY=<your key>`  
   - (optional) `GEMINI_MODEL=gemini-2.5-pro` or `gemini-2.5-flash`
2) Restart `npm run dev`.
3) Paste a public YouTube URL and run analysis. If Gemini returns 404, try a different `GEMINI_MODEL` your key can access.

### Latency and cost expectations
- Gemini + YouTube mode is variable: core runs are often a few minutes, but full runs (advanced signals + salvage) can take 20–40+ minutes on longer videos.
- API usage incurs Gemini and YouTube quotas/billing; pick a lighter model (e.g., `gemini-2.5-flash`) if you want lower cost/latency.
- Pricing reference + cost estimation: see `docs/gemini_pricing.md` (uses Gemini usageMetadata; excludes caching/grounding/storage).

### Privacy
- No raw video is stored or downloaded. The app stores URLs, derived fingerprints, and analysis results. When performance is enabled, only YouTube Analytics metrics are stored; OAuth tokens are encrypted and can be revoked via the UI (Disconnect YouTube) or by deleting token rows.

### Performance / Analytics mode
- Set `ENABLE_PERFORMANCE=true` and provide: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL`, `TOKEN_ENCRYPTION_KEY`. Use a Web OAuth client with redirect whitelisted (e.g., `http://localhost:3000/api/auth/youtube/callback`).
- Connect YouTube from the landing page. Running an analysis for a video on the connected channel will attach `performanceProfile` (retention, CTR, views, likes, comments) and show the Performance tab + “Performance at a glance.”
- Disconnect YouTube at any time via the landing page (tokens revoked/deleted).

### Debugging & regression helpers
- `/dev/multimodal` (dev-only) hits the same multimodal pipeline as `/api/analyze`; it includes unobserved metric counts and links to `docs/axes_and_domains.md` for axis definitions.
- `npm run probe:ingestion -- --url <youtube-url>` tests Gemini YouTube URL ingestion with timing and status output.
- `npm run golden:multimodal` runs the small golden set against live Gemini keys to spot regressions in story/music/pacing detection (see `docs/multimodal_golden_set.md`).

### E2E flows and iteration docs
- **Iteration 1**: `docs/iteration_1_e2e.md` – mock-only URL → Overview → domain tabs.
- **Iteration 2**: `docs/iteration_2_e2e.md` – Gemini + YouTube Data integration, creative fingerprint end-to-end.
- **Iteration 3**: `docs/iteration_3_e2e.md` – UX/coaching polish, sample/demo flow.
- **Iteration 4**: `docs/iteration_4_e2e.md` – Performance mode (YouTube OAuth + Analytics) end-to-end.
- **Iteration 5**: `docs/iteration_5_e2e.md` – quick checklist that combines running an analysis, revisiting it via “Recent analyses”, and (optionally) seeing the Performance tab with live data.
- **Iteration 6**: `docs/iteration_6_e2e.md` – alignment/load scaffold (schema v1.3.0, mock alignment/load metrics, UI Alignment & Load section).
- **Iteration 11**: `docs/iteration_11_e2e.md` – durable worker loop, stage resume, and restart flow.
- **Axes glossary**: `docs/axes_and_domains.md` – human-readable meanings for meta/domain axes and how to interpret scores/unobserved states.
