# Iteration 4 – E2E Checklist (Performance & Analytics)

Use this to verify both creative-only and performance-aware flows.

## Env setup
- Copy `.env.example` to `.env`.
- For mock-only: `ANALYSIS_MODE=mock` (no external keys needed).
- For Gemini creative-only:
  - Set `ANALYSIS_MODE=gemini`.
  - Provide `GEMINI_API_KEY` and `YOUTUBE_API_KEY`.
- For Gemini + Performance (YouTube Analytics):
  - Keep the Gemini vars above.
  - Set `ENABLE_PERFORMANCE=true`.
  - Provide:
    - `GOOGLE_CLIENT_ID`
    - `GOOGLE_CLIENT_SECRET`
    - `GOOGLE_REDIRECT_URL` (e.g., `http://localhost:3000/api/auth/youtube/callback`)
    - `TOKEN_ENCRYPTION_KEY` (>=32 chars; used to encrypt OAuth tokens).
  - Ensure the redirect URI is whitelisted in your Google Cloud OAuth client.
- Run migrations (from a fresh clone, in order):
  - `npm run prisma:migrate -- --name init`
  - `npm run prisma:migrate -- --name add-failure-reason` (if not yet applied)
  - `npm run prisma:migrate -- --name add-oauth-auth-tables`
  - `npm run prisma:migrate -- --name add-session-id`
  - `npm run prisma:migrate -- --name add-video-metadata`

## Mock mode
1) `npm run dev` and open http://localhost:3000.
2) Paste any YouTube URL or click **Try a sample analysis**.
3) Confirm Overview shows archetype, radar, insights, nearest references, domain tabs, and Performance tab shows the empty state/CTA.

## Gemini mode (creative-only)
1) Set `ANALYSIS_MODE=gemini` with `GEMINI_API_KEY` and `YOUTUBE_API_KEY` configured, restart `npm run dev`.
2) Paste a public YouTube URL and click **Analyze video**.
3) Confirm:
   - Overview and domain tabs show non-mock data (summaries and scores driven by Gemini).
   - Performance tab continues to show the “Performance data unavailable” message (YouTube OAuth not connected yet).

## Gemini + Performance (Analytics enabled)

This flow verifies the full Performance domain (H) using YouTube Analytics for a video you own.

1) Ensure env is set:
   - `ANALYSIS_MODE=gemini`
   - `GEMINI_API_KEY`, `YOUTUBE_API_KEY`
   - `ENABLE_PERFORMANCE=true`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URL`, `TOKEN_ENCRYPTION_KEY`
2) Restart `npm run dev` and open http://localhost:3000.
3) Click **Connect YouTube** on the landing card:
   - Complete the OAuth consent flow with a Google account that owns at least one YouTube video.
   - On success, you are redirected back to `/` and an encrypted YouTube OAuth token is stored for a local “dev user”.
4) Paste a URL for a video on the connected channel and click **Analyze video**.
5) After analysis completes, confirm:
   - Overview shows the usual archetype, radar, and insights **plus** a “Performance at a glance” card when Analytics data is available.
   - The **Performance** tab displays:
     - A retention curve over time (0–100% of video).
     - Beat markers (hook/setup/escalation/payoff/outro) aligned to the timeline when multimodal beats are available.
     - Basic metrics (views, CTR, avg view duration, likes, comments).
     - Performance coaching bullets that reference retention and metrics.
   - Other tabs (Voice/Language/Narrative/Visual/Editing/Sound) still show their usual creative insights.
6) Click **Disconnect YouTube** on the landing card:
   - Confirm the UI reports tokens revoked.
   - Subsequent analyses return to creative-only behavior (Performance tab back to the “connect YouTube” CTA).

## Expected outcomes
- No server/client errors in console during any of the flows.
- Successful analyses persist `VideoAnalysis` and `VideoFingerprint` rows; when Analytics is available:
  - Fingerprints include a `performanceProfile` and `hasPerformanceData === true`.
  - The Performance tab renders retention + metrics with beat markers aligned to multimodal narrative roles.
- When Analytics fails (e.g., quota errors or ownership issues):
  - The creative fingerprint is still returned and rendered.
  - Performance data is omitted and the Performance tab falls back to the empty/CTA state.
- Error states (invalid URL, missing envs, OAuth denied) surface clear messages in the UI and do not crash the app.
