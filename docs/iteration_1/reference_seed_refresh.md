# Reference Library Pipeline (Seeds, Refresh, Drift)

We use mock seeds for local dev, then refresh with Gemini to populate observed alignment/load metrics. Drift checks quantify changes when models or prompts change.

## Seed reference creators (mock fingerprints)
1) Run the seed script:
   ```bash
   npm run seed
   ```
2) Optional: dry run or scope the run:
   ```bash
   npm run seed -- --dry-run
   npm run seed -- --only high-energy-commentator,calm-storyteller
   npm run seed -- --limit 2
   ```

## Refresh fingerprints (Gemini, periodic)
1) Ensure `.env` has `ANALYSIS_MODE=gemini` plus valid `GEMINI_API_KEY` and `YOUTUBE_API_KEY`.
2) Allow refresh and run:
   ```bash
   ALLOW_REFERENCE_REFRESH=true npm run reference:refresh
   ```
3) Optional flags:
   ```bash
   ALLOW_REFERENCE_REFRESH=true npm run reference:refresh -- --dry-run
   ALLOW_REFERENCE_REFRESH=true npm run reference:refresh -- --stale-days 30
   ALLOW_REFERENCE_REFRESH=true npm run reference:refresh -- --only calm-storyteller
   ALLOW_REFERENCE_REFRESH=true npm run reference:refresh -- --output reports/reference-refresh.json
   ```
4) Verify refreshed fingerprints validate (`version=1.3.0`) and advanced metrics are observed where Gemini returned them.

## Drift checks (model upgrades)
1) Ensure `.env` has `ANALYSIS_MODE=gemini` plus valid keys.
2) Allow drift checks and run:
   ```bash
   ALLOW_REFERENCE_DRIFT=true npm run reference:drift -- --output reports/reference-drift.json
   ```
3) Optional flags:
   ```bash
   ALLOW_REFERENCE_DRIFT=true npm run reference:drift -- --max-mean-axis-delta 8 --max-axis-delta 20
   ALLOW_REFERENCE_DRIFT=true npm run reference:drift -- --pass-mode core
   ALLOW_REFERENCE_DRIFT=true npm run reference:drift -- --core-model gemini-2.5-flash --adv-audio-model gemini-2.5-pro
   ```
4) If drift is acceptable, refresh references to persist the new fingerprints.

## Notes
- Seeds remain mock-generated until the refresh is executed with real keys.
- Reference video IDs should point to stable, public YouTube videos; adjust `prisma/seed.ts` accordingly before running.
- If Gemini URL ingestion is blocked, the refresh will surface an error; re-run after resolving key/model/entitlement issues.
