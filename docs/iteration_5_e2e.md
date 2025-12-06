# Iteration 5 – E2E Checklist (Sessions, History, Performance-ready)

Use this checklist to sanity-check the full PRD MVP slice in a fresh local environment.

---

## Prerequisites
- Node 18+ (tested on Node 24) and npm.
- `npm install`
- Migrations applied (from a clean DB):
  - `npm run prisma:migrate -- --name init`
  - `npm run prisma:migrate -- --name add-failure-reason`
  - `npm run prisma:migrate -- --name add-oauth-auth-tables`
  - `npm run prisma:migrate -- --name add-session-id`
  - `npm run prisma:migrate -- --name add-video-metadata`
- Optional: seed reference creators – `npm run seed`

---

## Part 1 – Mock mode + History (no external APIs)
1) Set `.env`:
   - `ANALYSIS_MODE=mock`
2) Run `npm run dev` and open http://localhost:3000.
3) Paste any YouTube URL and click **Analyze video** (or run this twice with different URLs).
4) Confirm on Overview:
   - Archetype card, radar, insights, nearest references, and domain tabs render as expected.
   - The **Recent analyses (this browser)** panel shows your last N analyses in reverse chronological order.
5) Click **View analysis** on an entry:
   - The main Overview + domain tabs update to show that past analysis.
   - No network calls to Gemini/YouTube are required (data comes from stored fingerprints).
6) Open a new browser or clear cookies:
   - The Recent analyses panel should now show an empty state (“Run an analysis to see it listed here.”).

---

## Part 2 – Gemini creative-only (real analysis, no Analytics)
1) Update `.env`:
   - `ANALYSIS_MODE=gemini`
   - `GEMINI_API_KEY=<your key>`
   - `YOUTUBE_API_KEY=<your key>`
   - (optional) `GEMINI_MODEL=gemini-2.5-pro` or `gemini-2.5-flash`
2) Restart `npm run dev`.
3) Paste a public YouTube URL and click **Analyze video**.
4) Confirm:
   - Overview shows real metadata (thumbnail, title, channel, publish date, duration), archetype, radar, insights, and nearest references.
   - Domain tabs show Gemini-driven archetype descriptions, radars, and score bars.
   - Performance tab still shows the “Performance data unavailable / Connect YouTube” state.

---

## Part 3 – Gemini + Performance (optional)
1) In `.env` keep the Gemini keys and add:
   - `ENABLE_PERFORMANCE=true`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL` (e.g. `http://localhost:3000/api/auth/youtube/callback`)
   - `TOKEN_ENCRYPTION_KEY` (>=32 chars)
2) Restart `npm run dev`.
3) From the landing card, click **Connect YouTube** and complete OAuth with an account that owns at least one YouTube video.
4) Paste a URL for a video on the connected channel and click **Analyze video**.
5) Confirm:
   - Overview includes a **Performance at a glance** card summarizing retention and CTR metrics.
   - The **Performance** tab shows a retention curve, metrics (views, CTR, avg view duration, likes, comments), and performance coaching bullets.
6) Click **Disconnect YouTube** on the landing card:
   - Confirm future analyses revert to creative-only behavior and the Performance tab returns to the “Connect YouTube” CTA.

---

## Expected outcome
- In mock mode, a new user can:
  - Run at least one analysis and revisit it via the **Recent analyses** panel.
- In Gemini mode, they can:
  - See a full creative fingerprint with archetype, radar, references, and domain views powered by real Gemini/YouTube Data.
- With performance enabled (optional), they can:
  - Connect YouTube via OAuth and see the Performance domain (H) with retention and metrics on at least one owned video.

