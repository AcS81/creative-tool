# Reference Seed Refresh (Iteration 7 Option B)

We are choosing **Option B** (refresh seeds with a one-time Gemini run) to populate observed alignment/load metrics for reference fingerprints. This requires real Gemini + YouTube keys and live calls; it was not executed in this sandboxed environment.

## How to refresh
1) Ensure `.env` has `ANALYSIS_MODE=gemini` plus valid `GEMINI_API_KEY` and `YOUTUBE_API_KEY`.
2) Allow the refresh script: `ALLOW_REFERENCE_REFRESH=true`.
3) Run a dry run first:
   ```bash
   ALLOW_REFERENCE_REFRESH=true npm run seed -- --dry-run
   ```
4) Run the actual refresh (writes new fingerprints to the DB):
   ```bash
   ALLOW_REFERENCE_REFRESH=true npm run seed && \
   ALLOW_REFERENCE_REFRESH=true node scripts/refresh-reference-library.ts
   ```
5) Verify refreshed fingerprints validate (`version=1.3.0`) and advanced metrics are observed where Gemini returned them.

## Notes
- Seeds remain mock-generated until the refresh is executed with real keys.
- Reference video IDs should point to stable, public YouTube videos; adjust `prisma/seed.ts` accordingly before running.
- If Gemini blocks `file_data`, the refresh will surface fallback/diagnostic flags; re-run after resolving entitlement issues.
