# Iteration 7 – E2E Checklist (Alignment/Load, Gemini)

Use this quick pass to verify the real alignment/load path in Gemini mode. Mock mode already exercises the schema; this checklist validates live metrics + UI surfaces.

## Setup
1) `.env` has `ANALYSIS_MODE=gemini`, `GEMINI_API_KEY`, and `YOUTUBE_API_KEY`.
2) Optional: set `ENABLE_ADVANCED_METRICS=true` (default) to ensure alignment/load is on.
3) Run `npm run dev`.

## Steps
1) Paste a public YouTube URL (ideally with clear edits + music). Submit.
2) Confirm `/api/analyze` response includes `diagnostics.source="gemini-v2-multimodal"`, `advancedMetricsObserved=true`, and `multimodalFallbackUsed` matches log (fallback use marks lower confidence).
3) In the Overview → Alignment & Load panel:
   - Audio-visual / Beats vs edits scores present (not “—”).
   - Cognitive load sparkline renders (or a clear “No load timeline” message if unobserved).
4) Insights card includes at least one alignment/load bullet (e.g., alignment strength/weakness, load spike) without referencing unobserved data.
5) Domain tabs show callouts:
   - Voice: pace variance visible when observed.
   - Narrative: time-to-hook visible when observed.
   - Visual/Editing: silence fidelity and alignment note visible when observed.
   - Sound: alignment note visible when observed.
6) Run `npm run golden:multimodal -- --dry-run` to verify envs; optionally run without `--dry-run` to log alignment/load summaries for the golden set.

## Expected
- Fingerprint version `1.3.0` with advanced metrics populated (or defaulted with diagnostics if Gemini could not observe them).
- Diagnostics reflect fallback use and advanced metric observation state.
- UI surfaces alignment/load metrics gracefully even if some metrics are unobserved.
