# Iteration 4 – E2E Checklist (Performance & Analytics)

Use this to verify both creative-only and performance-aware flows.

## Env setup
- Copy `.env.example` to `.env`.
- For mock-only: `ANALYSIS_MODE=mock` (no keys needed).
- For Gemini: set `ANALYSIS_MODE=gemini`, `GEMINI_API_KEY`, `YOUTUBE_API_KEY`.
- For Performance: set `ENABLE_PERFORMANCE=true`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL` (e.g., `http://localhost:3000/api/auth/youtube/callback`), `TOKEN_ENCRYPTION_KEY` (>=32 chars). Ensure redirect URI is whitelisted in Google Cloud.
- Run migrations: `npm run prisma:migrate -- --name add-oauth-auth-tables` (if not applied), plus earlier migrations.

## Mock mode
1) `npm run dev` and open http://localhost:3000.
2) Paste any YouTube URL or click **Try a sample analysis**.
3) Confirm Overview shows archetype, radar, insights, nearest references, domain tabs, and Performance tab shows the empty state/CTA.

## Gemini mode
1) Set `ANALYSIS_MODE=gemini` with keys, restart `npm run dev`.
2) Paste a public YouTube URL and analyze.
3) Confirm Overview and domain tabs show real data; Performance tab should still show empty state (no OAuth).

## Gemini + Performance
1) With Performance env vars set, click **Connect YouTube** and complete OAuth (use a video you own).
2) Paste a URL for a video on the connected channel and analyze.
3) Confirm:
   - Overview includes “Performance at a glance.”
   - Performance tab shows retention chart, metrics, and performance coaching.
   - Disconnect works via **Disconnect YouTube** (tokens cleared).

## Expected outcomes
- No server/client errors in console.
- Successful analyses persist `VideoAnalysis`, `VideoFingerprint` (with optional `performanceProfile`).
- Error states (invalid URL, missing envs, OAuth denied) return clear messages.
