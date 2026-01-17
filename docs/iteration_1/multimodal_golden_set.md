# Multimodal Golden Set (Regression Helper)

Use this opt-in script to sanity-check multimodal outputs against a handful of known videos. It is **not** required for CI; it’s for local/staging runs when you have valid Gemini + YouTube keys.

## Prereqs
- `ANALYSIS_MODE=gemini`
- `GEMINI_API_KEY` (and optionally `YOUTUBE_API_KEY` if needed in your environment)
- Multimodal flag on by default; no other env needed.

## Run
```bash
npm run golden:multimodal [-- --dry-run]
```
- Without `--dry-run`, the script runs the multimodal analyzer for each video in `scripts/run-multimodal-golden.ts`.
- If you don’t have keys handy, add `--dry-run` and it will exit early after checking envs.

## Golden set config
- Create `scripts/golden-set.json` from `scripts/golden-set.sample.json` and replace the placeholder URLs with your canonical clips.
- Keep `scripts/golden-set.json` private (it’s gitignored) and use `GOLDEN_SET_PATH` if you want to point to a different file.
- Each entry can encode expectations: hook timing, music coverage bucket, pacing bucket (speaking rate), story presence, silence spans, audience addresses, and required timelines.

## What to look for
- Logs include unobserved metric counts and key metrics: music coverage/changes, cut rate, story presence, and alignment/load snapshots (alignmentScore, loadHighlights).
- Compare the printed metrics to the expected notes (story/music/pacing). Large mismatches are a signal to revisit prompts or parsers.
- Coverage lines show observed/total per section, plus an average summary at the end.
- If a run fails, check Gemini availability and retry; the runner uses URL-only ingestion (no uploads).

## CI guidance
- Do not enable real golden runs in CI. If you add a CI-friendly variant, mock Gemini responses and gate it behind an env (not provided here).

## Alignment/load coverage
The golden set now includes a vlog, a fast-cut commentary, a music-heavy video, and a tutorial to exercise:
- Cross-modal alignment (audioVisualEmphasisAlignment, beatsVsEditsAlignment, alignmentScore)
- Cognitive load spikes (cognitiveLoad.loadHighlights)
- Modality balance (redundancyVsComplementarity, modalityOverReliance)
