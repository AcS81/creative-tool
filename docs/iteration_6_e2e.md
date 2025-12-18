# Iteration 6 E2E Checklist – Alignment & Cognitive Load Scaffolding

Goal: verify the alignment/load metrics flow end-to-end in mock mode (no Gemini keys required) now that schema v1.3.0 and UI placeholders are in place.

## Preconditions
- `.env` has `ANALYSIS_MODE=mock`.
- Seeded references optional: `npm run seed`.
- App running via `npm run dev` at http://localhost:3000.

## Steps (mock mode)
1) **Run a mock analysis**  
   - Paste any YouTube URL (mock ignores content) and submit.
   - Wait for Overview to load with radar + archetype chips.
2) **Check Alignment & Load section** (Overview)  
   - Find the “Alignment & Load” panel under the radar.  
   - Confirm four tiles: Audio-visual emphasis, Beats vs edits, Modality over-reliance, Cognitive load trend.  
   - Cognitive load shows a simple sparkline; scores are populated (not “—”).  
   - Tiles hide gracefully if data is missing (test by removing fingerprint in dev tools, optional).
3) **Inspect fingerprints**  
   - `result.fingerprint.version` is `1.3.0`.  
   - `fingerprint.visualEditAlignment.audioVisualEmphasisAlignment.score` etc. are numbers (not defaulted).  
   - `fingerprint.cognitiveLoad.loadPerSecond.timeline` has values.
4) **Recent analyses**  
   - Run a second URL; both appear in “Recent analyses (this browser)”.  
   - Clicking one reloads the analysis without errors; Alignment & Load section still shows deterministic values.
5) **Docs links**  
   - Overview “What do these axes mean?” link opens `docs/axes_and_domains.md` (alignment/glossary section included).  
   - Alignment glossary lives at `docs/alignment_glossary.md` for redundant vs complementary vs conflicting examples.

## Expected outputs (mock)
- Deterministic alignment/load metrics tied to `videoId`: audio-visual alignment, beats vs edits, modality over-reliance, redundancy vs complementarity, cognitive load timeline, and second-order alignment/drift/decay/balance/timing scores.
- Diagnostics flags: `advancedMetricsObserved: true`, `advancedMetricsDefaulted: false` from mock analyzer.

## Notes
- Gemini path is still schematic for alignment/load; real multimodal measurement lands in Iteration 7.  
- Schema upgrade shim rewrites v1.1/v1.2 fingerprints to v1.3.0 with default “unobserved” advanced metrics.  
- UI uses only existing Recharts styles; no new dependencies introduced.
