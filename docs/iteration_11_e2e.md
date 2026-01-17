# Iteration 11 E2E (Durable Analysis Worker)

## Prereqs
1) Ensure `.env` has `ANALYSIS_MODE=gemini` plus `GEMINI_API_KEY` and `YOUTUBE_API_KEY`.
2) Run the Prisma migration that adds analysis worker fields:
   - `npm run prisma:migrate -- --name add-analysis-worker`

## Flow
1) Start the Next.js app and worker:
   - `npm run dev:all`
2) Paste a YouTube URL and run a full analysis.
3) Watch the UI stage + heartbeat update while it runs.
4) While the analysis is still running, stop the worker (`Ctrl+C` in the worker terminal).
5) Wait ~2 minutes until the UI marks the heartbeat as stalled.
6) Restart the worker:
   - `npm run worker`
7) The job should resume from the last completed stage and finish without restarting earlier stages.

## Notes
- If the schema or analysis config changes, the job restarts from ingestion (expected).
- For mock mode, the worker still runs but jobs complete quickly.
