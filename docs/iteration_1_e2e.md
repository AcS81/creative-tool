# Iteration 1 – Happy Path (Local)

Use this checklist to verify the end-to-end experience locally.

## Prerequisites
- Node 18+ and npm installed.
- `.env` created from `.env.example` (SQLite URL + CACHE_DIR).
- DB migrated: `npm run prisma:migrate -- --name init`
- Seed reference creators: `npm run seed`

## Steps
1) Start the dev server: `npm run dev` (open http://localhost:3000).
2) Paste a valid YouTube URL (e.g., `https://youtu.be/testvideo123`).
3) Click “Analyze video”.
4) Confirm you see:
   - Overall archetype text.
   - Radar chart with user polygon + reference average.
   - Nearest reference creators listed.
   - “Where you’re unusual” bullet list.
5) Switch tabs (Overview → Voice/Language/etc.) without losing data; see domain cards with bars.
6) Refresh page (state clears). Optional: re-run to confirm repeat analyses work.

## Optional API-only check
- `curl -X POST http://localhost:3000/api/analyze -H "Content-Type: application/json" -d '{"url":"https://youtu.be/testvideo123"}'`
- Verify response includes `videoAnalysisId`, `fingerprint.version === "1.0.0"`, `nearestReferences`, `nicheAverageMetaAxes`, and `insights`.

## Expected outcome
- No console/server errors.
- UI renders archetype, radar, neighbours, insights, and domain placeholders.
