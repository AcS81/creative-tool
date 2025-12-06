# CreatorSight (Iteration 3 – Experience & Coaching polish)

CreatorSight is a local Next.js app for analyzing YouTube videos. Iteration 3 adds UX polish, richer insights, and a sample/demo run alongside Gemini + YouTube Data support.

## Stack
- Next.js 16 (App Router, TypeScript, Tailwind CSS 4)
- Prisma + SQLite (file-based)
- ESLint + Prettier
- Vitest for unit tests, Recharts for radar visualization

## Getting started
1) Prerequisites: Node 18+ (tested on Node 24), npm.
2) Install dependencies: `npm install`
3) Copy envs: `cp .env.example .env` (adjust DB path if needed). The default `ANALYSIS_MODE=mock` keeps everything local.
4) Run migrations (includes latest columns such as `failureReason`, auth tables):  
   - `npm run prisma:migrate -- --name init` (first time)  
   - `npm run prisma:migrate -- --name add-failure-reason` (if you pulled after that change)  
   - `npm run prisma:migrate -- --name add-oauth-auth-tables` (if not already applied)
5) (Optional) Seed reference creators: `npm run seed`
6) Start the app: `npm run dev` then open http://localhost:3000.
7) Optional demo: click “Try a sample analysis” on the landing card to see the full experience without external keys.

## Useful scripts
- `npm run dev` / `npm run build` / `npm start`
- `npm run lint`
- `npm run format` / `npm run format:fix`
- `npm run prisma:migrate -- --name <label>` (SQLite)
- `npm run prisma:studio` (opens Prisma Studio)
- `npm run seed` (populate reference creators + fingerprints)
- `npm run test` (Vitest)

## Notes
- `/` lets you paste a YouTube URL, run the analysis API, and see archetype, radar chart (with reference average), nearest references, overview insights, and domain tabs (radars + score bars + micro-insights). A sample analysis button is available for instant demo.
- Prisma models include core entities; more detail will arrive in later iterations.

## Analysis modes
- `mock` (default): deterministic, offline-friendly analysis. Works without external API keys.
- `gemini`: real Gemini + YouTube Data API. Requires `GEMINI_API_KEY`, `YOUTUBE_API_KEY`, and optional `GEMINI_MODEL` (default `gemini-2.5-pro`). Requests fail fast with `MisconfiguredEnvironment` if keys are missing.

### Run in mock mode
1) Ensure `.env` has `ANALYSIS_MODE=mock`.
2) `npm run dev` and analyze any YouTube URL (data is deterministic). Or click “Try a sample analysis” to load prebuilt results instantly.

### Run in gemini mode
1) Set in `.env`:  
   - `ANALYSIS_MODE=gemini`  
   - `GEMINI_API_KEY=<your key>`  
   - `YOUTUBE_API_KEY=<your key>`  
   - (optional) `GEMINI_MODEL=gemini-2.5-pro` or `gemini-2.5-flash`
2) Restart `npm run dev`.
3) Paste a public YouTube URL and run analysis. If Gemini returns 404, try a different `GEMINI_MODEL` your key can access.

### Latency and cost expectations
- Gemini + YouTube mode may take up to 5–10 minutes for a long video; calls are synchronous in this iteration.
- API usage incurs Gemini and YouTube quotas/billing; pick a lighter model (e.g., `gemini-2.5-flash`) if you want lower cost/latency.

### Privacy
- No raw video is stored or downloaded. The app stores URLs, derived fingerprints, and analysis results. When performance is enabled, only YouTube Analytics metrics are stored; OAuth tokens are encrypted and can be revoked via the UI (Disconnect YouTube) or by deleting token rows.

### Performance / Analytics mode (Iteration 4)
- Set `ENABLE_PERFORMANCE=true` and provide: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL`, `TOKEN_ENCRYPTION_KEY`. Use a Web OAuth client with redirect whitelisted (e.g., `http://localhost:3000/api/auth/youtube/callback`).
- Connect YouTube from the landing page. Running an analysis for a video on the connected channel will attach `performanceProfile` (retention, CTR, views, likes, comments) and show the Performance tab + “Performance at a glance.”
- Disconnect YouTube at any time via the landing page (tokens revoked/deleted).

### E2E flows
- Mock mode: set `ANALYSIS_MODE=mock`, run `npm run dev`, paste any URL, or click sample. Expect archetype, radar, insights, domain tabs.
- Gemini mode: set `ANALYSIS_MODE=gemini` with `GEMINI_API_KEY`/`YOUTUBE_API_KEY`; run a real URL to see live fingerprints.
- Gemini + Performance: set performance envs above, connect YouTube, analyze a video you own. Expect performance summary on Overview, Performance tab with retention + metrics + coaching.
