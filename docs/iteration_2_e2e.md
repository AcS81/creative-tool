# Iteration 2 E2E Checklist

This describes manual end-to-end checks for both `mock` and `gemini` modes. Use it after applying migrations and seeds.

## Prerequisites
- Node 18+ (tested on Node 24)
- `npm install`
- Migrations applied (includes `failureReason` column): `npm run prisma:migrate -- --name init` then `npm run prisma:migrate -- --name add-failure-reason` if pulled after that change.
- Optional: `npm run seed` to load reference creators.

## Mock mode (offline, deterministic)
1) Set `.env` to `ANALYSIS_MODE=mock` (keys not needed).
2) `npm run dev` and open http://localhost:3000.
3) Paste any YouTube URL and analyze.
4) Verify:
   - Overview shows archetype, radar, nearest references, unusual insights.
   - Domain tabs show pentagram, summary, highlights; timelines render if supporting data exists.
5) Confirm DB rows created (VideoAnalysis, VideoFingerprint) with status `complete`.

## Gemini mode (live APIs)
1) Set in `.env`:
   - `ANALYSIS_MODE=gemini`
   - `GEMINI_API_KEY=<your key>`
   - `YOUTUBE_API_KEY=<your key>`
   - Optional: `GEMINI_MODEL=gemini-2.5-pro` (or a model your key can access)
2) Restart `npm run dev`.
3) Paste a public YouTube URL and analyze.
4) Verify:
   - Overview shows real metadata (title, channel, publish date, duration), archetype, radar, neighbours, unusual insights.
   - Domain tabs show pentagram, summary, highlights, timelines.
   - On upstream failure, `VideoAnalysis.status` is `failed` with `failureReason`.
5) DB should have new VideoAnalysis/VideoFingerprint rows; status `complete` on success.

## Automated API check (mocked)
- `npm test` runs the API route test that mocks YouTube/Gemini and asserts filled meta axes, domain data, and nearest references.
