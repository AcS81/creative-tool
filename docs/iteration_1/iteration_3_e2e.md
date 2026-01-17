# Iteration 3 – E2E Checklist (Experience & Coaching polish)

This describes manual end-to-end checks for Iteration 3. Covers mock mode, Gemini mode, and the new sample/demo path.

## Prerequisites
- Node 18+ (tested on Node 24)
- `npm install`
- Migrations applied (init + failureReason): `npm run prisma:migrate -- --name init` then `npm run prisma:migrate -- --name add-failure-reason` if needed.
- Optional: `npm run seed` to load reference creators.

## Mock mode (offline, deterministic)
1) Set `.env` to `ANALYSIS_MODE=mock` (keys not needed).
2) `npm run dev` and open http://localhost:3000.
3) Either:
   - Paste any YouTube URL and click **Analyze video**; or
   - Click **Try a sample analysis** to load a prebuilt fingerprint instantly.
4) Verify on Overview:
   - Hero shows archetype card with domain chips + video metadata (thumbnail/title/channel/date/duration).
   - Radar renders with legend + axis labels.
   - Insights card shows bullets (or “Not enough reference data yet” if no references).
   - Nearest references card renders (seed data required).
5) Verify domain tabs:
   - Consistent layout (title, archetype descriptions, radar + score bars).
   - Tags and micro-insights present (or gracefully empty).
   - Narrative/Editing show timeline when supporting data exists.

## Gemini mode (live APIs)
1) Set in `.env`:
   - `ANALYSIS_MODE=gemini`
   - `GEMINI_API_KEY=<your key>`
   - `YOUTUBE_API_KEY=<your key>`
   - Optional: `GEMINI_MODEL=gemini-2.5-pro` (or a model your key can access)
2) Restart `npm run dev`.
3) Paste a public YouTube URL and analyze.
4) Verify:
   - Overview shows real metadata, archetype, radar, insights, and neighbours.
   - Domain tabs show archetype descriptions, radars, score bars, tags, and micro-insights.
   - On upstream failure, `VideoAnalysis.status` becomes `failed` with `failureReason` and the UI surfaces an error state.

## Sample/demo path (no external APIs)
1) Ensure app is running (either mode).
2) Click **Try a sample analysis** on the landing card (or “Load sample analysis” in empty state).
3) Confirm Overview and domain tabs populate immediately with demo data.

## Automated checks
- `npm test` runs unit and API route tests (mocked) and should pass.
